"use client";

import { useMemo, useState, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { CardFan } from "@/components/room/shithead/CardFan";
import { SuitPicker } from "@/components/room/onecard/SuitPicker";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { canPlayOneCard, sortOneCardHand, type OneCard } from "@/server/onecard/deck";
import type { Suit } from "@/server/shithead/deck";

export interface OneCardMyHandProps {
  userId: string;
  hand: OneCard[];
  pile: OneCard[];
  attackStack: number;
  declaredSuit: Suit | null;
  isMyTurn: boolean;
  /** 게임 시작 직후라 딜(덱에서 날아드는) 연출을 재생할지 여부. */
  dealIn: boolean;
  /** 지금 누군가 "원카드"를 외쳐야 하는 상태인지 — 모두에게 버튼이 뜬다. */
  callPending: boolean;
  onPlayCard: (cardId: string, suit?: Suit) => void;
  onDraw: () => void;
  onCall: () => void;
}

/**
 * 내 손패 영역. 카드 한 장을 골라 "내기" 버튼으로 낸다(싯헤드와 같은 조작).
 * 낼 수 없는 카드는 흐리게 표시하고, 먹기 버튼으로 덱에서 카드를 가져온다.
 * @param props - 내 손패 상태와 액션 콜백
 * @param props.userId
 * @param props.hand
 * @param props.pile
 * @param props.attackStack
 * @param props.declaredSuit
 * @param props.isMyTurn
 * @param props.dealIn
 * @param props.callPending
 * @param props.onPlayCard
 * @param props.onDraw
 * @param props.onCall
 * @returns 내 손패 영역 엘리먼트
 */
export const OneCardMyHand = ({
  userId,
  hand,
  pile,
  attackStack,
  declaredSuit,
  isMyTurn,
  dealIn,
  callPending,
  onPlayCard,
  onDraw,
  onCall,
}: OneCardMyHandProps): JSX.Element => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 7을 내려고 무늬를 고르는 중인지.
  const [pickingSuit, setPickingSuit] = useState(false);

  // 항상 낮은 랭크(A)가 왼쪽, 조커가 맨 오른쪽에 오도록 정렬한다. 카드 id가
  // 유지되므로 CardFan의 FLIP 애니메이션이 자리 이동을 자연스럽게 보여준다.
  const sortedHand = useMemo(() => sortOneCardHand(hand), [hand]);

  const top = pile[pile.length - 1];
  /**
   * 지금 이 카드를 낼 수 있는지 확인한다.
   * @param card - 확인할 카드
   * @returns 낼 수 있으면 true
   */
  const isLegal = (card: OneCard): boolean =>
    top ? canPlayOneCard(top, card, declaredSuit, attackStack) : false;

  /**
   * 카드 선택을 토글한다. 낼 수 있는 카드 한 장만 고를 수 있다.
   * @param card - 토글할 카드
   */
  const toggleCard = (card: OneCard): void => {
    if (!isMyTurn || !isLegal(card)) return;
    setSelectedId((prev) => (prev === card.id ? null : card.id));
  };

  /** 고른 카드를 낸다. 7이면 무늬를 먼저 고르게 한다. */
  const handlePlay = (): void => {
    if (!selectedId) return;
    if (sortedHand.find((c) => c.id === selectedId)?.rank === "7") {
      setPickingSuit(true);
      return;
    }
    onPlayCard(selectedId);
    setSelectedId(null);
  };

  /**
   * 무늬 선택 창에서 무늬를 고르면 7을 낸다.
   * @param suit - 지정할 무늬
   */
  const handlePickSuit = (suit: Suit): void => {
    if (selectedId) onPlayCard(selectedId, suit);
    setSelectedId(null);
    setPickingSuit(false);
  };

  return (
    <div
      className={`flex flex-col items-start gap-3 rounded-xl border bg-slate-900/40 px-3 pt-3 pb-4 ${
        isMyTurn ? "border-indigo-500" : "border-slate-800"
      }`}
    >
      <div data-anchor={SHITHEAD_ANCHOR.field(userId)} className="flex w-full items-end">
        <div
          data-anchor={SHITHEAD_ANCHOR.hand(userId)}
          data-hand-align="end"
          className="flex min-h-[5.625rem] min-w-0 flex-1 items-end sm:min-h-[6.625rem]"
        >
          <CardFan
            cardKeys={sortedHand.map((c) => c.id)}
            playerId={userId}
            dealInOnMount={dealIn}
          >
            {sortedHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                selected={selectedId === card.id}
                disabled={!isLegal(card)}
                onClick={isMyTurn ? (): void => toggleCard(card) : undefined}
              />
            ))}
          </CardFan>
        </div>
      </div>

      <div className="flex w-full justify-center gap-2">
        <button
          onClick={handlePlay}
          disabled={!isMyTurn || selectedId === null}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-base font-medium transition hover:bg-indigo-500 disabled:opacity-40"
        >
          내기
        </button>
        <button
          onClick={onDraw}
          disabled={!isMyTurn}
          className="rounded-lg border border-slate-700 px-6 py-2.5 text-base font-medium transition hover:bg-slate-800 disabled:opacity-40"
        >
          {attackStack > 0 ? `${attackStack}장 먹기` : "카드 먹기"}
        </button>
        {/* 한 장 남은 사람이 생기면 모두에게 뜬다 — 당사자가 누르면 외치기
            성공, 다른 사람이 먼저 누르면 지적이 되어 당사자가 벌칙을 받는다. */}
        {callPending && (
          <button
            onClick={onCall}
            className="rounded-lg bg-amber-500 px-6 py-2.5 text-base font-bold text-amber-950 transition hover:bg-amber-400"
          >
            원카드!
          </button>
        )}
      </div>

      {pickingSuit && (
        <SuitPicker
          onPick={handlePickSuit}
          onCancel={(): void => setPickingSuit(false)}
        />
      )}
    </div>
  );
};
