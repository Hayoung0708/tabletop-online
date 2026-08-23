"use client";

import { useEffect, useState, type RefObject } from "react";
import { HAND_CARD_WIDTH_PX } from "@/constants/shithead";

export interface HandMetrics {
  /** 손패 영역의 실제 폭(px). */
  width: number;
  /** 카드 한 장의 실제 폭(px). */
  cardWidth: number;
}

/**
 * 손패 겹침 계산에 필요한 실제 치수를 잰다. 폭은 화면 크기에 따라 달라지고
 * (카드 56px/64px), 카드 수가 바뀌면 다시 재야 한다.
 *
 * 치수는 getBoundingClientRect가 아니라 offsetWidth로 읽는다 — 전자는
 * transform까지 반영해서, 덱에서 날아드는 딜 연출로 카드가 축소돼 있는 동안
 * 카드 폭이 실제보다 작게 잡히고 그만큼 쓸데없이 겹쳐 버린다.
 * @param containerRef - 카드 래퍼들이 직계 자식인 컨테이너 ref
 * @param count - 지금 손패 장수 (바뀌면 다시 잰다)
 * @returns 손패 영역 폭과 카드 한 장의 폭
 */
export const useHandMetrics = (
  containerRef: RefObject<HTMLElement | null>,
  count: number,
): HandMetrics => {
  const [metrics, setMetrics] = useState<HandMetrics>({
    width: 0,
    cardWidth: HAND_CARD_WIDTH_PX,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /** 지금 레이아웃 기준으로 폭을 다시 잰다. */
    const measure = (): void => {
      const first = container.firstElementChild as HTMLElement | null;
      const cardWidth = first?.offsetWidth ?? 0;
      setMetrics((prev) => {
        const next: HandMetrics = {
          width: container.clientWidth,
          cardWidth: cardWidth > 0 ? cardWidth : prev.cardWidth,
        };
        return prev.width === next.width && prev.cardWidth === next.cardWidth
          ? prev
          : next;
      });
    };

    measure();
    // 첫 렌더 직후에는 레이아웃이 덜 잡혀 있을 수 있어 다음 프레임에 한 번 더.
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return (): void => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [containerRef, count]);

  return metrics;
};
