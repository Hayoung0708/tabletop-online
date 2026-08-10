"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { playSoundOnce } from "@/utils/sound";
import { CARD_TAKE_FROM_DECK_SOUND_SRC } from "@/constants/media";
import {
  CARD_FLIGHT_DURATION_MS,
  HAND_DEAL_INTRA_MS,
  HAND_PHASE_OFFSET_MS,
  SHITHEAD_ANCHOR,
} from "@/constants/shithead";

/**
 * 손패 딜 연출 훅. 딜 시작 신호(shithead_deal_start)를 받으면 손패 단계 시점에
 * 컨테이너의 각 카드를 덱에서 맨 왼쪽 카드 자리로 날린 뒤, 다음 카드가 도착할
 * 때마다 오른쪽으로 밀리도록(연속 슬라이드) 애니메이션을 건다. 도착 순서는 최종
 * 맨 오른쪽 카드부터. 내 손패(CardFan)와 상대 손패(OpponentRow)가 같이 쓴다.
 * @param containerRef - 카드 래퍼들이 직계 자식으로 들어있는 컨테이너 ref
 * @param enabled - 딜 연출을 쓸지 여부
 * @returns 애니메이션이 걸렸는지(그 전까지는 카드를 감춰야 함)
 */
export const useHandDealIn = (
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean => {
  const [flying, setFlying] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;

    /** 딜 시작 신호 — 손패 단계 시점에 카드별 비행+밀림 애니메이션을 건다. */
    const onDealStart = (): void => {
      if (started.current) return;
      started.current = true;

      setTimeout(() => {
        const container = containerRef.current;
        const deckEl = document.querySelector(`[data-anchor="${SHITHEAD_ANCHOR.deck}"]`);
        const deckRect = deckEl?.getBoundingClientRect();
        const wrappers = container
          ? (Array.from(container.children) as HTMLElement[])
          : [];
        if (wrappers.length === 0 || !deckRect || deckRect.height === 0) {
          setFlying(true);
          return;
        }

        const leftX = wrappers[0].getBoundingClientRect().left;
        const count = wrappers.length;
        wrappers.forEach((wrapper, index) => {
          const rect = wrapper.getBoundingClientRect();
          // 도착 순서: 최종 오른쪽 카드(index 큰 쪽)가 먼저 온다.
          const arrival = count - 1 - index;
          const slideMs = Math.max(1, (count - 1 - arrival) * HAND_DEAL_INTRA_MS);
          const total = CARD_FLIGHT_DURATION_MS + slideMs;
          const flyEnd = CARD_FLIGHT_DURATION_MS / total;
          const scale = rect.height > 0 ? deckRect.height / rect.height : 1;
          const dxDeck =
            deckRect.left + deckRect.width / 2 - (rect.left + rect.width / 2);
          const dyDeck =
            deckRect.top + deckRect.height / 2 - (rect.top + rect.height / 2);
          const dxLeft = leftX - rect.left;

          // 이 카드가 덱에서 출발하는 순간의 소리. 같은 순번 카드는 모든
          // 플레이어에게 동시에 날아가므로 playSoundOnce가 한 번으로 묶는다.
          setTimeout(
            () => playSoundOnce(CARD_TAKE_FROM_DECK_SOUND_SRC),
            arrival * HAND_DEAL_INTRA_MS,
          );

          wrapper.animate(
            [
              {
                transform: `translate(${dxDeck}px, ${dyDeck}px) scale(${scale}) rotate(-8deg)`,
                opacity: 0,
                offset: 0,
              },
              { opacity: 1, offset: Math.min(0.2, flyEnd * 0.5) },
              {
                transform: `translate(${dxLeft}px, 0) scale(1) rotate(0deg)`,
                offset: flyEnd,
              },
              { transform: "none", offset: 1 },
            ],
            {
              duration: total,
              delay: arrival * HAND_DEAL_INTRA_MS,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "backwards",
            },
          );
        });
        setFlying(true);
      }, HAND_PHASE_OFFSET_MS);
    };

    window.addEventListener("shithead_deal_start", onDealStart);
    return (): void => {
      window.removeEventListener("shithead_deal_start", onDealStart);
    };
  }, [enabled, containerRef]);

  return flying;
};
