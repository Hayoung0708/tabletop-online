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
  onPlayCard: (cardId: string, suit?: Suit) => void;
  onDraw: () => void;
}

/**
 * 내 손패 영역. 카드를 클릭하면 바로 낸다(7은 무늬 선택 창이 먼저 뜬다).
 * 낼 수 없는 카드는 흐리게 표시하고, 먹기 버튼으로 덱에서 카드를 가져온다.
 * @param props - 내 손패 상태와 액션 콜백
 * @param props.userId
 * @param props.hand
 * @param props.pile
 * @param props.attackStack
 * @param props.declaredSuit
 * @param props.isMyTurn
 * @param props.dealIn
 * @param props.onPlayCard
 * @param props.onDraw
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
  onPlayCard,
  onDraw,
}: OneCardMyHandProps): JSX.Element => {
  // 7을 클릭한 뒤 무늬를 고르는 동안 어느 카드였는지 기억해 둔다.
  const [pendingSevenId, setPendingSevenId] = useState<string | null>(null);

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
   * 카드를 클릭했을 때: 7이면 무늬 선택 창을 띄우고, 아니면 바로 낸다.
   * @param card - 클릭한 카드
   */
  const handleCardClick = (card: OneCard): void => {
    if (!isMyTurn || !isLegal(card)) return;
    if (card.rank === "7") {
      setPendingSevenId(card.id);
      return;
    }
    onPlayCard(card.id);
  };

  /**
   * 무늬 선택 창에서 무늬를 고르면 7을 낸다.
   * @param suit - 지정할 무늬
   */
  const handlePickSuit = (suit: Suit): void => {
    if (pendingSevenId) onPlayCard(pendingSevenId, suit);
    setPendingSevenId(null);
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
                disabled={!isLegal(card)}
                onClick={isMyTurn ? (): void => handleCardClick(card) : undefined}
              />
            ))}
          </CardFan>
        </div>
      </div>

      <div className="flex w-full justify-center">
        <button
          onClick={onDraw}
          disabled={!isMyTurn}
          className="rounded-lg border border-slate-700 px-6 py-2.5 text-base font-medium transition hover:bg-slate-800 disabled:opacity-40"
        >
          {attackStack > 0 ? `${attackStack}장 먹기` : "카드 먹기"}
        </button>
      </div>

      {pendingSevenId && (
        <SuitPicker
          onPick={handlePickSuit}
          onCancel={(): void => setPendingSevenId(null)}
        />
      )}
    </div>
  );
};
