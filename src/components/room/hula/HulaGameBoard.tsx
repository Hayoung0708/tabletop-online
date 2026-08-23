"use client";

import { useEffect, useState, type JSX } from "react";
import { HulaOpponentRow } from "@/components/room/hula/HulaOpponentRow";
import { HulaCenter } from "@/components/room/hula/HulaCenter";
import { HulaMeldBoard } from "@/components/room/hula/HulaMeldBoard";
import { HulaMyHand } from "@/components/room/hula/HulaMyHand";
import { HulaFinishedPanel } from "@/components/room/hula/HulaFinishedPanel";
import { YahtzeeCelebration } from "@/components/room/yatzy/YahtzeeCelebration";
import { CenterAnnounceToast } from "@/components/room/CenterAnnounceToast";
import { useHulaActions } from "@/hooks/hula/useHulaActions";
import { useHulaSounds } from "@/hooks/hula/useHulaSounds";
import { useHulaAnnouncements } from "@/hooks/hula/useHulaAnnouncements";
import { useStarterAnnounce } from "@/hooks/shithead/useStarterAnnounce";
import { useCenterAnnounce } from "@/hooks/useCenterAnnounce";
import { useYahtzeeCelebrations } from "@/hooks/yatzy/useYahtzeeCelebrations";
import { HULA_DECK_DRAW_DELAY_MS, HULA_STOP_MAX_POINTS } from "@/constants/hula";
import { canSelectTogether } from "@/server/hula/meld";
import { hulaHandPoints } from "@/server/hula/deck";
import type { PublicRoomState } from "@/server/roomManager";

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
  const { drawCard, registerMeld, appendCard, discardCard, cancelThankYou, callStop } =
    useHulaActions();
  const { announce, showAnnounce } = useCenterAnnounce();
  const { celebrations, addCelebration, removeCelebration } = useYahtzeeCelebrations();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const game = state.game.type === "HULA" ? state.game : null;

  // 차례가 넘어간 직후에는 덱을 잠가 둔다 — 그동안 다른 사람이 더미를
  // 가져갈(땡큐) 기회를 준다. 서버도 같은 시간으로 막는다. 열린 차례를
  // 기록해 두고 비교하면, 차례가 바뀌는 순간 따로 되돌리지 않아도 다시 잠긴다.
  const turnKey = `${game?.currentPlayerId ?? ""}:${game?.movesMade ?? 0}`;
  const [deckReadyTurnKey, setDeckReadyTurnKey] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDeckReadyTurnKey(turnKey), HULA_DECK_DRAW_DELAY_MS);
    return (): void => clearTimeout(timer);
  }, [turnKey]);
  const deckReady = deckReadyTurnKey === turnKey;

  /**
   * 게스트 id로 닉네임을 찾는다.
   * @param id - 찾을 게스트 id
   * @returns 닉네임, 없으면 "-"
   */
  const nicknameOf = (id: string): string =>
    state.players.find((p) => p.userId === id)?.nickname ?? "-";

  useHulaSounds();
  useHulaAnnouncements({
    players: state.players,
    showAnnounce,
    onHula: addCelebration,
  });

  // 게임이 시작된 순간(아직 아무도 수를 두지 않았을 때) 시작 플레이어를 알린다.
  useStarterAnnounce(
    state.status === "PLAYING" && game?.movesMade === 0,
    nicknameOf(game?.currentPlayerId ?? ""),
    showAnnounce,
  );

  if (!game) return null;
  const me = game.players.find((p) => p.userId === userId);
  if (!me) return null;

  // 승자가 정해진 뒤에는 공개 연출만 남는다 — 조작은 전부 잠근다.
  const isOver = game.winnerUserId !== null;
  const isMyTurn = game.currentPlayerId === userId && !isOver;
  const dealIn = game.movesMade === 0;
  const myThankYouCardId =
    game.thankYou?.playerId === userId ? game.thankYou.cardId : null;
  // 스톱은 카드를 가져오기 전에만 부를 수 있다.
  const canStop =
    isMyTurn && !game.hasDrawn && hulaHandPoints(me.hand ?? []) <= HULA_STOP_MAX_POINTS;

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

  /** 땡큐를 취소하고 차례를 원래 순서로 되돌린다. */
  const handleCancelThankYou = (): void => {
    cancelThankYou();
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
            canDrawDeck={isMyTurn && !game.hasDrawn && deckReady}
            canDrawDiscard={!isOver && !game.hasDrawn && game.discard.length > 0}
            onDraw={drawCard}
          />

          <HulaMyHand
            userId={userId}
            hand={me.hand ?? []}
            selectedIds={selectedIds}
            isMyTurn={isMyTurn}
            hasDrawn={game.hasDrawn}
            dealIn={dealIn}
            thankYouCardId={myThankYouCardId}
            canStop={canStop}
            onToggleCard={toggleCard}
            onRegister={handleRegister}
            onDiscard={handleDiscard}
            onCancelThankYou={handleCancelThankYou}
            onStop={callStop}
          />
        </>
      )}

      {state.status === "FINISHED" && (
        <HulaFinishedPanel
          players={state.players}
          hulaPlayers={game.players}
          stoppedByUserId={game.stoppedByUserId}
        />
      )}

      {celebrations.map((celebration) => (
        <YahtzeeCelebration
          key={celebration.id}
          onDone={() => removeCelebration(celebration.id)}
        />
      ))}

      <CenterAnnounceToast announce={announce} />
    </>
  );
};
