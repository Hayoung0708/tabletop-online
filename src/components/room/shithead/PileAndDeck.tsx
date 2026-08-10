"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { getSocket } from "@/lib/socket";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import {
  BURN_VANISH_MS,
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

  // 더미가 타서 사라질 때: 서버가 실제로 비우기 직전에 지금 보이는 맨 위
  // 카드를 붙잡아 두고, 사라지는 연출이 끝나야 놓아준다 — 그래야 쌓인
  // 모습을 보여준 뒤 없어지는 순서가 지켜지고, 갑자기 빈 자리로 바뀌지 않는다.
  const [burningCard, setBurningCard] = useState<Card | null>(null);

  useEffect(() => {
    const socket = getSocket();
    /** 서버가 더미를 태우기 직전에 알려주면, 지금 보이는 카드를 붙잡아 둔다. */
    const onBurned = (): void => {
      if (topCard) setBurningCard(topCard);
    };
    socket.on("shithead_pile_burned", onBurned);
    return (): void => {
      socket.off("shithead_pile_burned", onBurned);
    };
  }, [topCard]);

  useEffect(() => {
    if (!burningCard) return;
    const timer = setTimeout(() => setBurningCard(null), BURN_VANISH_MS);
    return (): void => clearTimeout(timer);
  }, [burningCard]);

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
        <div
          data-anchor={SHITHEAD_ANCHOR.pile}
          className="relative h-20 w-14 sm:h-24 sm:w-16"
        >
          {/* 점선 빈 자리는 항상 밑에 깔아 둔다 — 카드가 있으면 완전히
              가려지고, 태워 사라질 때는 카드만 애니메이션되며 자리는
              그대로 남아 있어 "카드만 사라지는" 모습이 된다. */}
          <div className={EMPTY_SLOT_CLASS} />
          {burningCard && (
            <div className="absolute inset-0">
              <BurningPileCard card={burningCard} />
            </div>
          )}
          {!burningCard && topCard && (
            <div className="absolute inset-0">
              {/* key로 카드가 바뀔 때 엘리먼트를 새로 만든다 — 같은 노드를
                  재사용하면 남아 있던 스타일이 전이되며 색이 한 번 반짝일 수 있다. */}
              <PlayingCard key={topCard.id} card={topCard} />
            </div>
          )}
        </div>
        <span className="text-sm text-slate-400">더미 {visibleLen}장</span>
      </div>
    </div>
  );
};

export interface BurningPileCardProps {
  card: Card;
}

/**
 * 더미가 타서 사라지는 연출. 마운트되는 순간 살짝 커졌다가 회전하며
 * 줄어들어 사라진다.
 * @param props - 사라질 카드
 * @param props.card
 * @returns 사라지는 카드 엘리먼트
 */
const BurningPileCard = ({ card }: BurningPileCardProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
        { transform: "scale(1.08) rotate(0deg)", opacity: 1, offset: 0.2 },
        { transform: "scale(0.4) rotate(18deg)", opacity: 0 },
      ],
      { duration: BURN_VANISH_MS, easing: "ease-in", fill: "forwards" },
    );
  }, []);

  return (
    <div ref={ref}>
      <PlayingCard card={card} />
    </div>
  );
};
