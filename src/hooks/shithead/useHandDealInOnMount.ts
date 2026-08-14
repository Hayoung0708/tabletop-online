"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { playSoundOnce } from "@/utils/sound";
import { CARD_TAKE_FROM_DECK_SOUND_SRC } from "@/constants/media";
import {
  CARD_FLIGHT_DURATION_MS,
  HAND_DEAL_INTRA_MS,
  SHITHEAD_ANCHOR,
} from "@/constants/shithead";

/** 덱 앵커가 아직 안 그려졌을 때 다시 확인하기까지의 간격(ms). */
const DEAL_RETRY_INTERVAL_MS = 50;
/** 앵커 재확인 최대 횟수 — 이만큼 지나도 없으면 딜 연출을 포기한다. */
const DEAL_RETRY_LIMIT = 12;

interface DealCardParams {
  /** 덱 앵커의 화면상 사각형 — 카드가 출발하는 자리. */
  deckRect: DOMRect;
  /** 손패 맨 왼쪽 카드의 x좌표 — 카드는 여기 착지한 뒤 제자리로 밀린다. */
  leftX: number;
  /** 손패 전체 장수. */
  count: number;
  /** 이 카드의 최종 자리(0이 맨 왼쪽). */
  index: number;
}

/**
 * 카드 한 장이 덱에서 손패 맨 왼쪽으로 날아와 제자리로 밀리는 연출을 건다.
 * 출발 순간에 덱 소리도 함께 낸다.
 * @param wrapper - 카드 래퍼 엘리먼트
 * @param params - 덱 위치와 이 카드의 자리 정보
 * @param params.deckRect
 * @param params.leftX
 * @param params.count
 * @param params.index
 */
const dealCardIn = (
  wrapper: HTMLElement,
  { deckRect, leftX, count, index }: DealCardParams,
): void => {
  const rect = wrapper.getBoundingClientRect();
  // 도착 순서: 최종 오른쪽 카드(index 큰 쪽)가 먼저 온다.
  const arrival = count - 1 - index;
  const slideMs = Math.max(1, (count - 1 - arrival) * HAND_DEAL_INTRA_MS);
  const total = CARD_FLIGHT_DURATION_MS + slideMs;
  const flyEnd = CARD_FLIGHT_DURATION_MS / total;
  const scale = rect.height > 0 ? deckRect.height / rect.height : 1;
  const dxDeck = deckRect.left + deckRect.width / 2 - (rect.left + rect.width / 2);
  const dyDeck = deckRect.top + deckRect.height / 2 - (rect.top + rect.height / 2);
  const dxLeft = leftX - rect.left;

  // 이 카드가 덱에서 출발하는 순간의 소리 — 여러 플레이어에게 같은 순번
  // 카드가 동시에 날아가도 playSoundOnce가 한 번으로 묶는다.
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
};

/**
 * 마운트 직후 컨테이너의 카드들을 덱에서 날아들게 하는 딜 연출 훅.
 * 소켓 이벤트 없이 첫 렌더에서 바로 실행되므로, 딜 이벤트가 따로 없는
 * 게임(원카드)이 쓴다. 덱 앵커가 아직 안 그려졌으면 잠깐 뒤 다시 시도한다.
 * 같은 컨테이너에서는 한 번만 실행된다(재렌더에 다시 안 돈다).
 * @param containerRef - 카드 래퍼들이 직계 자식으로 들어있는 컨테이너 ref
 * @param enabled - 딜 연출을 쓸지 여부 (게임 시작 직후에만 true)
 */
export const useHandDealInOnMount = (
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void => {
  const started = useRef(false);

  useLayoutEffect(() => {
    if (!enabled || started.current) return;

    let retryTimer: number | null = null;

    /**
     * 덱 앵커와 카드가 준비됐으면 딜을 재생하고, 아직이면 잠깐 뒤 다시 시도한다.
     * 준비가 안 됐다고 그냥 끝내면 딜 연출이 영영 재생되지 않는다.
     * @param attempt - 지금까지의 시도 횟수
     */
    const run = (attempt: number): void => {
      const container = containerRef.current;
      const deckEl = document.querySelector(`[data-anchor="${SHITHEAD_ANCHOR.deck}"]`);
      const deckRect = deckEl?.getBoundingClientRect();
      const wrappers = container ? (Array.from(container.children) as HTMLElement[]) : [];
      if (wrappers.length === 0 || !deckRect || deckRect.height === 0) {
        if (attempt < DEAL_RETRY_LIMIT) {
          retryTimer = window.setTimeout(() => run(attempt + 1), DEAL_RETRY_INTERVAL_MS);
        }
        return;
      }

      started.current = true;
      const leftX = wrappers[0].getBoundingClientRect().left;
      const count = wrappers.length;
      wrappers.forEach((wrapper, index) => {
        dealCardIn(wrapper, { deckRect, leftX, count, index });
      });
    };

    run(0);
    return (): void => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [enabled, containerRef]);
};
