"use client";

import { useEffect, useState, type JSX } from "react";
import { Club, Diamond, Heart, RotateCcw, RotateCw, Spade, Swords } from "lucide-react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { CARD_FLIGHT_DURATION_MS, SHITHEAD_ANCHOR } from "@/constants/shithead";
import type { Suit } from "@/server/shithead/deck";
import type { OneCard } from "@/server/onecard/deck";

export interface OneCardCenterProps {
  pile: OneCard[];
  deckCount: number;
  direction: 1 | -1;
  attackStack: number;
  declaredSuit: Suit | null;
  /** 지금 덱을 클릭해 카드를 먹을 수 있는지 (내 차례일 때만). */
  canDraw: boolean;
  onDraw: () => void;
}

const EMPTY_SLOT_CLASS =
  "flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 sm:h-24 sm:w-16";

const SUIT_ICON: Record<Suit, typeof Club> = {
  clubs: Club,
  diamonds: Diamond,
  hearts: Heart,
  spades: Spade,
};

/**
 * 원카드 가운데 영역: 뽑을 덱(클릭하면 먹기)과 버려진 더미(맨 위 카드),
 * 그리고 진행 정보(공격 누적, 지정 무늬, 진행 방향) 배지.
 * 누가 카드를 내면 비행이 착지할 때까지 새 top을 감춰 스포일러를 막는다.
 * @param props - 더미/덱 상태와 진행 정보
 * @param props.pile
 * @param props.deckCount
 * @param props.direction
 * @param props.attackStack
 * @param props.declaredSuit
 * @param props.canDraw
 * @param props.onDraw
 * @returns 가운데 영역 엘리먼트
 */
export const OneCardCenter = ({
  pile,
  deckCount,
  direction,
  attackStack,
  declaredSuit,
  canDraw,
  onDraw,
}: OneCardCenterProps): JSX.Element => {
  // 렌더 단계에서 pile 증가를 즉시 감지해 새 top을 감춘다 (PileAndDeck과 같은 패턴).
  const [lastLen, setLastLen] = useState(pile.length);
  const [heldCount, setHeldCount] = useState(0);
  if (pile.length !== lastLen) {
    setLastLen(pile.length);
    setHeldCount(pile.length > lastLen ? pile.length - lastLen : 0);
  }

  useEffect(() => {
    if (heldCount === 0) return;
    /** 비행 카드가 착지하는 순간(또는 예비 타임아웃)에 감춤을 푼다. */
    const reveal = (): void => setHeldCount(0);
    window.addEventListener("shithead_play_landed", reveal);
    const fallback = setTimeout(reveal, CARD_FLIGHT_DURATION_MS + 600);
    return (): void => {
      window.removeEventListener("shithead_play_landed", reveal);
      clearTimeout(fallback);
    };
  }, [heldCount]);

  const visibleLen = pile.length - heldCount;
  const topCard = pile[visibleLen - 1];
  const DeclaredIcon = declaredSuit ? SUIT_ICON[declaredSuit] : null;
  const DirectionIcon = direction === 1 ? RotateCw : RotateCcw;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="flex min-h-6 items-center gap-2">
        {attackStack > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-950 px-3 py-1 text-sm font-bold text-red-300 ring-1 ring-red-700">
            <Swords className="h-4 w-4" /> 공격 +{attackStack}
          </span>
        )}
        {DeclaredIcon && declaredSuit && (
          <span
            className={`flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-sm font-bold ring-1 ring-slate-600 ${
              declaredSuit === "hearts" || declaredSuit === "diamonds"
                ? "text-red-400"
                : "text-slate-200"
            }`}
          >
            <DeclaredIcon className="h-4 w-4" fill="currentColor" /> 무늬 지정
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-slate-800/70 px-3 py-1 text-sm text-slate-400">
          <DirectionIcon className="h-4 w-4" /> 진행 방향
        </span>
      </div>

      <div className="flex items-start justify-center gap-4 sm:gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <div data-anchor={SHITHEAD_ANCHOR.deck}>
            {deckCount > 0 ? (
              <PlayingCard faceDown onClick={canDraw ? onDraw : undefined} />
            ) : (
              <button
                type="button"
                onClick={canDraw ? onDraw : undefined}
                disabled={!canDraw}
                className={EMPTY_SLOT_CLASS}
              />
            )}
          </div>
          <span className="text-sm text-slate-400">덱 {deckCount}장</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div
            data-anchor={SHITHEAD_ANCHOR.pile}
            className="relative h-20 w-14 sm:h-24 sm:w-16"
          >
            <div className={EMPTY_SLOT_CLASS} />
            {topCard && (
              <div className="absolute inset-0">
                {/* key로 카드가 바뀔 때 엘리먼트를 새로 만든다 — 색 전이 반짝임 방지. */}
                <PlayingCard key={topCard.id} card={topCard} />
              </div>
            )}
          </div>
          <span className="text-sm text-slate-400">더미 {visibleLen}장</span>
        </div>
      </div>
    </div>
  );
};
