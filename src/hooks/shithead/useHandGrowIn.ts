"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { CARD_FLIGHT_DURATION_MS, HAND_SHIFT_MS } from "@/constants/shithead";
import { getHandGrowSource } from "@/hooks/shithead/handGrowSource";

/** 카드 이동에 쓰는 공통 이징 — 빠르게 나갔다가 부드럽게 안착한다. */
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * 손패에 카드가 새로 들어왔을 때, 실제 카드 엘리먼트를 직접 움직여 연출한다.
 * 새 카드는 출발 지점(덱 또는 더미)에서 제자리로 날아오고, 원래 있던 카드는
 * 이전 위치에서 새 위치로 미끄러진다(FLIP). 오버레이 사본을 쓰지 않으므로
 * 같은 카드가 두 장으로 보이거나 연출이 겹칠 일이 없다.
 * @param containerRef - 카드 래퍼들이 직계 자식인 컨테이너 ref
 * @param keys - 카드별 고유 키(같은 카드면 렌더가 바뀌어도 같은 키여야 한다)
 * @param playerId - 이 손패의 주인 (출발 지점을 찾는 데 쓴다)
 * @param enabled - 연출을 켤지 여부 (딜 중에는 꺼둔다)
 */
export const useHandGrowIn = (
  containerRef: RefObject<HTMLElement | null>,
  keys: string[],
  playerId: string,
  enabled: boolean,
): void => {
  const prevLefts = useRef<Map<string, number>>(new Map());
  // "비교 대상이 없는 첫 렌더"인지는 이 플래그로만 판단한다. before.size===0로
  // 판단하면, 손패가 한 번 0장을 거쳤다가(카드를 전부 낸 직후) 다시 채워질 때도
  // "첫 렌더"로 오인해 연출을 건너뛴다 — 밀어낼 카드가 없을 뿐 실제로는 첫 렌더가
  // 아니라서, 그 순간 들어오는 새 카드들이 날아오지 않고 그냥 나타나 보인다.
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wrappers = Array.from(container.children) as HTMLElement[];
    // 위치 비교에는 transform의 영향을 받지 않는 offsetLeft를 쓴다 — 애니메이션
    // 도중에 다시 렌더돼도 기준 위치가 흔들리지 않는다.
    const lefts = new Map<string, number>();
    wrappers.forEach((wrapper, index) => {
      const key = keys[index];
      if (key !== undefined) lefts.set(key, wrapper.offsetLeft);
    });

    const before = prevLefts.current;
    prevLefts.current = lefts;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // 카드가 줄기만 해도(새로 온 카드 없이) 남은 카드들은 자리를 당겨와야
    // 하므로, 새 카드 유무와 상관없이 항상 검사한다 — 개별 카드는 실제로
    // 위치가 안 변했으면(dx가 0에 가까우면) 아래 루프에서 알아서 건너뛴다.
    if (!enabled) return;

    const sourceEl = document.querySelector(
      `[data-anchor="${getHandGrowSource(playerId)}"]`,
    );
    const sourceRect = sourceEl?.getBoundingClientRect();

    wrappers.forEach((wrapper, index) => {
      const key = keys[index];
      if (key === undefined) return;
      const previousLeft = before.get(key);

      if (previousLeft !== undefined) {
        // 원래 있던 카드 — 이전 자리에서 새 자리로 밀려난다.
        const dx = previousLeft - wrapper.offsetLeft;
        if (Math.abs(dx) < 0.5) return;
        wrapper.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], {
          duration: HAND_SHIFT_MS,
          easing: EASING,
          fill: "backwards",
        });
        return;
      }

      if (!sourceRect || sourceRect.height === 0) return;
      // 새로 들어온 카드 — 덱(또는 더미)에서 제자리로 날아온다.
      const rect = wrapper.getBoundingClientRect();
      const dx = sourceRect.left + sourceRect.width / 2 - (rect.left + rect.width / 2);
      const dy = sourceRect.top + sourceRect.height / 2 - (rect.top + rect.height / 2);
      wrapper.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { transform: "none", opacity: 1 },
        ],
        { duration: CARD_FLIGHT_DURATION_MS, easing: EASING, fill: "backwards" },
      );
    });
  }, [containerRef, keys, playerId, enabled]);
};
