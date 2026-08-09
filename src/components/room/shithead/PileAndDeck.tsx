"use client";

import { useEffect, useState, type JSX } from "react";
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

// 카드와 같은 치수 — 덱/더미도 손패와 똑같은 크기로 그린다.
const EMPTY_SLOT_CLASS =
  "flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 sm:h-24 sm:w-16";

/**
 * 가운데에 놓인 뽑을 덱과 버려진 더미(맨 위 카드만 보임). 각각 몇 장
 * 남았는지 카드 밑에 표시한다. 더미가 커지면(누가 카드를 냄) 날아오는 카드가
 * 착지할 때까지 방금 올라온 카드를 감춰서, 비행 중에 새 top이 미리 보이거나
 * 착지 순간 이전 top이 비쳐 보이는 걸 막는다. 감춤은 렌더 단계에서 걸어
 * 페인트 전에 적용되고, 해제는 오버레이가 쏘는 착지 이벤트에 맞춘다.
 * @param props - 더미/덱 상태
 * @param props.pile
 * @param props.deckCount
 * @returns 덱+더미 엘리먼트
 */
export const PileAndDeck = ({ pile, deckCount }: PileAndDeckProps): JSX.Element => {
  // 렌더 단계에서 pile 증가를 즉시 감지해 새 top을 감춘다 — 이펙트(페인트 후)로
  // 걸면 새 카드가 한두 프레임 먼저 비쳐 깜빡인다.
  const [lastLen, setLastLen] = useState(pile.length);
  const [heldCount, setHeldCount] = useState(0);
  if (pile.length !== lastLen) {
    setLastLen(pile.length);
    setHeldCount(pile.length > lastLen ? pile.length - lastLen : 0);
  }

  useEffect(() => {
    if (heldCount === 0) return;

    /** 비행 카드가 착지해 제거되는 순간(또는 예비 타임아웃)에 감춤을 푼다. */
    const reveal = (): void => setHeldCount(0);
    window.addEventListener("shithead_play_landed", reveal);
    // 이벤트를 못 받는 경우(연출 스킵 등)를 대비한 예비 해제.
    const fallback = setTimeout(
      reveal,
      CARD_FLIGHT_DURATION_MS + (heldCount - 1) * CARD_FLIGHT_STAGGER_MS + 600,
    );
    return (): void => {
      window.removeEventListener("shithead_play_landed", reveal);
      clearTimeout(fallback);
    };
  }, [heldCount]);

  const visibleLen = pile.length - heldCount;
  const topCard = pile[visibleLen - 1];

  return (
    <div className="flex items-start justify-center gap-6 py-4">
      <div className="flex flex-col items-center gap-1.5">
        <div data-anchor={SHITHEAD_ANCHOR.deck}>
          {deckCount > 0 ? (
            <PlayingCard faceDown />
          ) : (
            <div className={EMPTY_SLOT_CLASS} />
          )}
        </div>
        <span className="text-sm text-slate-400">덱 {deckCount}장</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div data-anchor={SHITHEAD_ANCHOR.pile}>
          {topCard ? (
            // key로 카드가 바뀔 때 엘리먼트를 새로 만든다 — 같은 노드를 재사용하면
            // 남아 있던 스타일이 전이되며 색이 한 번 반짝일 수 있다.
            <PlayingCard key={topCard.id} card={topCard} />
          ) : (
            <div className={EMPTY_SLOT_CLASS} />
          )}
        </div>
        <span className="text-sm text-slate-400">더미 {visibleLen}장</span>
      </div>
    </div>
  );
};
