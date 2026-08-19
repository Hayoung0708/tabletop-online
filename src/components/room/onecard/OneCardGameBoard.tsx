"use client";

import { useEffect, useRef, type JSX } from "react";
import { josa } from "es-hangul";
import { getSocket } from "@/lib/socket";
import { OneCardOpponentRow } from "@/components/room/onecard/OneCardOpponentRow";
import { OneCardCenter } from "@/components/room/onecard/OneCardCenter";
import { OneCardMyHand } from "@/components/room/onecard/OneCardMyHand";
import { OneCardFinishedPanel } from "@/components/room/onecard/OneCardFinishedPanel";
import { StarterAnnounceToast } from "@/components/room/shithead/StarterAnnounceToast";
import { Toast } from "@/components/feedback/Toast";
import { useOneCardActions } from "@/hooks/onecard/useOneCardActions";
import { useStarterAnnounce } from "@/hooks/shithead/useStarterAnnounce";
import { useToast } from "@/hooks/useToast";
import { setHandGrowSource } from "@/hooks/shithead/handGrowSource";
import {
  CARD_TAKE_FROM_DECK_SOUND_SRC,
  CARD_TAKE_FROM_PILE_SOUND_SRC,
} from "@/constants/media";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import type { PublicRoomState } from "@/server/roomManager";

/** 먹기 소리 지정이 유효한 시간(ms) — 곧바로 오는 손패 증가에만 적용. */
const DRAW_SOUND_TTL_MS = 1200;

export interface OneCardGameBoardProps {
  state: PublicRoomState;
  userId: string;
}

/**
 * 원카드 게임판: 상대 손패, 가운데 덱/더미와 진행 정보, 내 손패를 조립한다.
 * 상대는 턴 순서(내 다음 차례부터)대로 최대 두 줄에 배치한다(싯헤드와 동일).
 * 게임이 끝나면(FINISHED) 등수표만 보여준다.
 * @param props - 방 상태, 내 게스트 id
 * @param props.state
 * @param props.userId
 * @returns 원카드 게임판 엘리먼트, 원카드 방이 아니면 null
 */
export const OneCardGameBoard = ({
  state,
  userId,
}: OneCardGameBoardProps): JSX.Element | null => {
  const { playCard, drawCards, callOneCard } = useOneCardActions();
  const [toast, setToast] = useToast();

  const game = state.game.type === "ONECARD" ? state.game : null;

  /**
   * 게스트 id로 닉네임을 찾는다.
   * @param id - 찾을 게스트 id
   * @returns 닉네임, 없으면 "-"
   */
  const nicknameOf = (id: string): string =>
    state.players.find((p) => p.userId === id)?.nickname ?? "-";

  // 토스트 문구를 만들 때 최신 닉네임이 필요하지만, 구독은 한 번만 걸어야 한다.
  const nicknameOfRef = useRef(nicknameOf);
  useEffect(() => {
    nicknameOfRef.current = nicknameOf;
  });

  useEffect(() => {
    const socket = getSocket();
    /**
     * 외치기 판정 결과 — 성공/실패를 토스트로 알린다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 외쳤어야 하는 플레이어
     * @param root0.callerId
     * @param root0.success - 당사자가 제때 외쳤는지
     */
    const onCallResult = ({
      playerId,
      callerId,
      success,
    }: {
      playerId: string;
      callerId?: string;
      success: boolean;
    }): void => {
      const name = nicknameOfRef.current(playerId);
      if (success) {
        setToast({ text: `${name} 원카드!`, tone: "ok" });
        return;
      }
      const caller = nicknameOfRef.current(callerId ?? "");
      setToast({ text: `${josa(caller, "이/가")} ${name} 원카드 방어!`, tone: "error" });
    };
    socket.on("onecard_call_result", onCallResult);
    return (): void => {
      socket.off("onecard_call_result", onCallResult);
    };
  }, [setToast]);

  // 게임이 시작된 순간(아직 아무도 수를 두지 않았을 때) 시작 플레이어를 알린다.
  const starterAnnounce = useStarterAnnounce(
    state.status === "PLAYING" && game?.movesMade === 0,
    nicknameOf(game?.currentPlayerId ?? ""),
  );

  // 먹기 소리는 손패가 늘어나는 순간 바로 나야 한다. 소리를 지정하지 않으면
  // useHandGrowIn이 싯헤드 보충용 지연(REFILL_SOUND_DELAY_MS)을 태워 늦게
  // 들리는데, 원카드 먹기는 앞서 울릴 착지 소리가 없어 그냥 느려질 뿐이다.
  useEffect(() => {
    const socket = getSocket();
    /**
     * 먹기 알림 — 이 플레이어의 다음 손패 증가에 쓸 소리를 지정한다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 카드를 먹는 플레이어
     * @param root0.penalty - 공격을 못 막아 여러 장을 먹는 경우인지
     */
    const onDraw = ({
      playerId,
      penalty,
    }: {
      playerId: string;
      penalty: boolean;
    }): void => {
      setHandGrowSource(
        playerId,
        SHITHEAD_ANCHOR.deck,
        DRAW_SOUND_TTL_MS,
        penalty ? CARD_TAKE_FROM_PILE_SOUND_SRC : CARD_TAKE_FROM_DECK_SOUND_SRC,
      );
    };
    socket.on("onecard_draw", onDraw);
    return (): void => {
      socket.off("onecard_draw", onDraw);
    };
  }, []);

  if (!game) return null;
  const me = game.players.find((p) => p.userId === userId);
  if (!me) return null;

  const isMyTurn = game.currentPlayerId === userId;
  // 아직 아무도 수를 두지 않았으면 게임 시작 직후 — 손패 딜 연출을 재생한다.
  // 더미 장수로 판단하면 안 된다: 덱이 마르면 더미를 덱으로 되돌리면서
  // 더미가 다시 1장이 돼(replenishDeck) 게임 중간에 딜 연출이 되살아난다.
  const dealIn = game.movesMade === 0;

  // 상대는 턴 순서(나 다음 차례부터)대로 나열한다 — players 배열이 곧 좌석
  // 순서이므로 내 위치 기준으로 회전시키면 된다.
  const myIndex = game.players.findIndex((p) => p.userId === userId);
  const opponents = [
    ...game.players.slice(myIndex + 1),
    ...game.players.slice(0, myIndex),
  ];
  // 최대 두 줄 배치 — 1~2명: 한 줄에 한 명 / 3명: 1+2 / 4명: 2+2 / 5명: 2+3.
  const firstRowCount = opponents.length <= 2 ? 1 : Math.floor(opponents.length / 2);
  const opponentRows = [
    opponents.slice(0, firstRowCount),
    opponents.slice(firstRowCount),
  ].filter((row) => row.length > 0);

  return (
    <>
      {state.status === "PLAYING" && (
        <>
          <div className="flex flex-col gap-2">
            {opponentRows.map((row) => (
              <div key={row[0].userId} className="flex gap-2">
                {row.map((p) => (
                  <div key={p.userId} className="min-w-0 flex-1">
                    <OneCardOpponentRow
                      nickname={nicknameOf(p.userId)}
                      player={p}
                      isCurrentTurn={game.currentPlayerId === p.userId}
                      dealIn={dealIn}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <OneCardCenter
            pile={game.pile}
            deckCount={game.deckCount}
            direction={game.direction}
            attackStack={game.attackStack}
            declaredSuit={game.declaredSuit}
            canDraw={isMyTurn && me.finishRank === null}
            onDraw={drawCards}
          />

          <OneCardMyHand
            userId={userId}
            hand={me.hand ?? []}
            pile={game.pile}
            attackStack={game.attackStack}
            declaredSuit={game.declaredSuit}
            isMyTurn={isMyTurn}
            dealIn={dealIn}
            callPending={game.pendingCallPlayerId !== null}
            onPlayCard={playCard}
            onDraw={drawCards}
            onCall={callOneCard}
          />
        </>
      )}

      {state.status === "FINISHED" && (
        <OneCardFinishedPanel players={state.players} oneCardPlayers={game.players} />
      )}

      <StarterAnnounceToast announce={starterAnnounce} />
      <Toast toast={toast} />
    </>
  );
};
