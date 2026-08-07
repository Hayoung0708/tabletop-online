"use client";

import type { JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import type { Card } from "@/server/shithead/deck";

export interface PileAndDeckProps {
  pile: Card[];
  deckCount: number;
}

const EMPTY_SLOT_CLASS =
  "flex h-24 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 sm:h-28 sm:w-20";

/**
 * 가운데에 놓인 뽑을 덱과 버려진 더미(맨 위 카드만 보임). 각각 몇 장
 * 남았는지 카드 밑에 표시한다.
 * @param props - 더미/덱 상태
 * @param props.pile
 * @param props.deckCount
 * @returns 덱+더미 엘리먼트
 */
export const PileAndDeck = ({ pile, deckCount }: PileAndDeckProps): JSX.Element => {
  const topCard = pile[pile.length - 1];

  return (
    <div className="flex items-start justify-center gap-6 py-4">
      <div className="flex flex-col items-center gap-1.5">
        {deckCount > 0 ? (
          <PlayingCard faceDown size="large" />
        ) : (
          <div className={EMPTY_SLOT_CLASS} />
        )}
        <span className="text-sm text-slate-400">덱 {deckCount}장</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        {topCard ? (
          <PlayingCard card={topCard} size="large" />
        ) : (
          <div className={EMPTY_SLOT_CLASS} />
        )}
        <span className="text-sm text-slate-400">더미 {pile.length}장</span>
      </div>
    </div>
  );
};
