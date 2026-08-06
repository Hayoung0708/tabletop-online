"use client";

import type { JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import type { Card } from "@/server/shithead/deck";

export interface PileAndDeckProps {
  pile: Card[];
  deckCount: number;
}

/**
 * 가운데에 놓인 뽑을 덱과 버려진 더미(맨 위 카드만 보임).
 * @param props - 더미/덱 상태
 * @param props.pile
 * @param props.deckCount
 * @returns 덱+더미 엘리먼트
 */
export const PileAndDeck = ({ pile, deckCount }: PileAndDeckProps): JSX.Element => {
  const topCard = pile[pile.length - 1];

  return (
    <div className="flex items-center justify-center gap-8 py-4">
      <div className="flex flex-col items-center gap-1.5">
        {deckCount > 0 ? (
          <PlayingCard faceDown />
        ) : (
          <div className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 text-xs text-slate-600 sm:h-24 sm:w-16">
            빈 덱
          </div>
        )}
        <span className="text-xs text-slate-500">덱 {deckCount}장</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        {topCard ? (
          <PlayingCard card={topCard} />
        ) : (
          <div className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 text-xs text-slate-600 sm:h-24 sm:w-16">
            빈 더미
          </div>
        )}
        <span className="text-xs text-slate-500">더미 {pile.length}장</span>
      </div>
    </div>
  );
};
