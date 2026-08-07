"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import {
  CARD_FLIGHT_DURATION_MS,
  CARD_FLIGHT_STAGGER_MS,
  SHITHEAD_ANCHOR,
} from "@/constants/shithead";
import type { Card } from "@/server/shithead/deck";

export interface PileAndDeckProps {
  pile: Card[];
  deckCount: number;
}

const EMPTY_SLOT_CLASS =
  "flex h-[6.25rem] w-[4.375rem] items-center justify-center rounded-lg border-2 border-dashed border-slate-700 sm:h-[7.5rem] sm:w-20";

/**
 * 가운데에 놓인 뽑을 덱과 버려진 더미(맨 위 카드만 보임). 각각 몇 장
 * 남았는지 카드 밑에 표시한다.
 * @param props - 더미/덱 상태
 * @param props.pile
 * @param props.deckCount
 * @returns 덱+더미 엘리먼트
 */
export const PileAndDeck = ({ pile, deckCount }: PileAndDeckProps): JSX.Element => {
  // 더미가 커지면(카드를 냄) 날아온 카드가 착지할 때까지 방금 올라온 카드를 잠깐
  // 감춰서, 정지한 카드와 날아오는 카드가 겹쳐 한 장 더 낸 것처럼 보이는 걸 막는다.
  const prevLen = useRef(pile.length);
  const [holdCount, setHoldCount] = useState<number | null>(null);

  useEffect(() => {
    const grown = pile.length - prevLen.current;
    prevLen.current = pile.length;
    if (grown <= 0) return;
    const holdMs = CARD_FLIGHT_DURATION_MS + (grown - 1) * CARD_FLIGHT_STAGGER_MS + 40;
    const raf = requestAnimationFrame(() => setHoldCount(grown));
    const timer = setTimeout(() => setHoldCount(null), holdMs);
    return (): void => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [pile.length]);

  const visibleLen = holdCount !== null ? pile.length - holdCount : pile.length;
  const topCard = pile[visibleLen - 1];

  return (
    <div className="flex items-start justify-center gap-6 py-4">
      <div className="flex flex-col items-center gap-1.5">
        <div data-anchor={SHITHEAD_ANCHOR.deck}>
          {deckCount > 0 ? (
            <PlayingCard faceDown size="large" />
          ) : (
            <div className={EMPTY_SLOT_CLASS} />
          )}
        </div>
        <span className="text-sm text-slate-400">덱 {deckCount}장</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div data-anchor={SHITHEAD_ANCHOR.pile}>
          {topCard ? (
            <PlayingCard card={topCard} size="large" />
          ) : (
            <div className={EMPTY_SLOT_CLASS} />
          )}
        </div>
        <span className="text-sm text-slate-400">더미 {visibleLen}장</span>
      </div>
    </div>
  );
};
