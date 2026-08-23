"use client";

import { useEffect, useState, type JSX } from "react";
import { getSocket } from "@/lib/socket";
import { HulaOpponentRow } from "@/components/room/hula/HulaOpponentRow";
import { HulaCenter } from "@/components/room/hula/HulaCenter";
import { HulaMeldBoard } from "@/components/room/hula/HulaMeldBoard";
import { HulaMyHand } from "@/components/room/hula/HulaMyHand";
import { HulaFinishedPanel } from "@/components/room/hula/HulaFinishedPanel";
import { CenterAnnounceToast } from "@/components/room/CenterAnnounceToast";
import { useHulaActions } from "@/hooks/hula/useHulaActions";
import { useStarterAnnounce } from "@/hooks/shithead/useStarterAnnounce";
import { useCenterAnnounce } from "@/hooks/useCenterAnnounce";
import { setHandGrowSource } from "@/hooks/shithead/handGrowSource";
import {
  CARD_PLACE_SOUND_SRC,
  CARD_TAKE_FROM_DECK_SOUND_SRC,
  CARD_TAKE_FROM_PILE_SOUND_SRC,
} from "@/constants/media";
import { playSoundOnce } from "@/utils/sound";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { canSelectTogether } from "@/server/hula/meld";
import type { HulaDrawSource } from "@/server/hula/gameLogic";
import type { PublicRoomState } from "@/server/roomManager";

/** 가져오기 소리·출발점 지정이 유효한 시간(ms) — 곧바로 오는 손패 증가에만 적용. */
const DRAW_SOURCE_TTL_MS = 1200;

export interface HulaGameBoardProps {
  state: PublicRoomState;
  userId: string;
}

/**
 * 훌라 게임판: 상대 손패, 등록된 조합, 가운데 덱/더미, 내 손패를 조립한다.
 * 게임이 끝나면(FINISHED) 벌점표만 보여준다.
 * @param props - 방 상태, 내 게스트 id
 * @param props.state
 * @param props.userId
 * @returns 훌라 게임판 엘리먼트, 훌라 방이 아니면 null
 */
export const HulaGameBoard = ({
  state,
  userId,
}: HulaGameBoardProps): JSX.Element | null => {
  const { drawCard, registerMeld, appendCard, discardCard } = useHulaActions();
  const { announce, showAnnounce } = useCenterAnnounce();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const game = state.game.type === "HULA" ? state.game : null;

  /**
   * 게스트 id로 닉네임을 찾는다.
   * @param id - 찾을 게스트 id
   * @returns 닉네임, 없으면 "-"
   */
  const nicknameOf = (id: string): string =>
    state.players.find((p) => p.userId === id)?.nickname ?? "-";

  // 가져온 카드는 덱/더미 어느 쪽에서 왔는지에 따라 출발점과 소리가 다르다.
  useEffect(() => {
    const socket = getSocket();
    /**
     * 가져오기 알림 — 이 플레이어의 다음 손패 증가 출발점과 소리를 지정한다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 카드를 가져간 플레이어
     * @param root0.source - 가져온 곳
     */
    const onDraw = ({
      playerId,
      source,
    }: {
      playerId: string;
      source: HulaDrawSource;
    }): void => {
      const fromDiscard = source === "discard";
      setHandGrowSource(
        playerId,
        fromDiscard ? SHITHEAD_ANCHOR.pile : SHITHEAD_ANCHOR.deck,
        DRAW_SOURCE_TTL_MS,
        fromDiscard ? CARD_TAKE_FROM_PILE_SOUND_SRC : CARD_TAKE_FROM_DECK_SOUND_SRC,
      );
    };
    socket.on("hula_draw", onDraw);
    return (): void => {
      socket.off("hula_draw", onDraw);
    };
  }, []);

  // 조합을 내려놓을 때(등록)와 남의 조합에 한 장 붙일 때의 소리.
  useEffect(() => {
    const socket = getSocket();
    /** 조합 등록 — 여러 장을 한꺼번에 내려놓으니 더미 쓸어오는 소리를 쓴다. */
    const onMeld = (): void => playSoundOnce(CARD_TAKE_FROM_PILE_SOUND_SRC);
    /** 붙이기 — 카드 한 장이 바닥에 놓이는 소리. */
    const onAppend = (): void => playSoundOnce(CARD_PLACE_SOUND_SRC);

    socket.on("hula_meld", onMeld);
    socket.on("hula_append", onAppend);
    return (): void => {
      socket.off("hula_meld", onMeld);
      socket.off("hula_append", onAppend);
    };
  }, []);

  // 게임이 시작된 순간(아직 아무도 수를 두지 않았을 때) 시작 플레이어를 알린다.
  useStarterAnnounce(
    state.status === "PLAYING" && game?.movesMade === 0,
    nicknameOf(game?.currentPlayerId ?? ""),
    showAnnounce,
  );

  if (!game) return null;
  const me = game.players.find((p) => p.userId === userId);
  if (!me) return null;

  const isMyTurn = game.currentPlayerId === userId;
  const dealIn = game.movesMade === 0;

  /**
   * 손패 카드 선택을 토글한다. 지금 고른 카드들과 같이 등록할 수 없는 카드를
   * 누르면(예: A를 고른 채 4를 누름) 그 카드 하나만 남긴다 — 애초에 조합이
   * 안 되는 묶음은 고를 수 없게 한다.
   * @param cardId - 토글할 카드 id
   */
  const toggleCard = (cardId: string): void => {
    const hand = me.hand ?? [];
    const card = hand.find((c) => c.id === cardId);
    if (!card) return;

    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      const selected = hand.filter((c) => prev.includes(c.id));
      return canSelectTogether(selected, card) ? [...prev, cardId] : [cardId];
    });
  };

  /** 고른 카드들을 조합으로 등록한다. */
  const handleRegister = (): void => {
    registerMeld(selectedIds);
    setSelectedIds([]);
  };

  /** 고른 카드 한 장을 버린다. */
  const handleDiscard = (): void => {
    if (selectedIds.length !== 1) return;
    discardCard(selectedIds[0]);
    setSelectedIds([]);
  };

  /**
   * 고른 카드 한 장을 이 조합에 붙인다.
   * @param meldId - 붙일 조합 id
   */
  const handleAppend = (meldId: string): void => {
    if (selectedIds.length !== 1) return;
    appendCard(meldId, selectedIds[0]);
    setSelectedIds([]);
  };

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
                    <HulaOpponentRow
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

          <HulaMeldBoard
            melds={game.melds}
            nicknameOf={nicknameOf}
            canAppend={
              isMyTurn && game.hasDrawn && me.registered && selectedIds.length === 1
            }
            onAppend={handleAppend}
          />

          <HulaCenter
            deckCount={game.deckCount}
            discard={game.discard}
            canDraw={isMyTurn && !game.hasDrawn}
            onDraw={drawCard}
          />

          <HulaMyHand
            userId={userId}
            hand={me.hand ?? []}
            selectedIds={selectedIds}
            isMyTurn={isMyTurn}
            hasDrawn={game.hasDrawn}
            dealIn={dealIn}
            onToggleCard={toggleCard}
            onRegister={handleRegister}
            onDiscard={handleDiscard}
          />
        </>
      )}

      {state.status === "FINISHED" && (
        <HulaFinishedPanel players={state.players} hulaPlayers={game.players} />
      )}

      <CenterAnnounceToast announce={announce} />
    </>
  );
};
