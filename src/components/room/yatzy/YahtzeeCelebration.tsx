"use client";

import { useEffect, useRef, type JSX } from "react";
import type { AnimationItem } from "lottie-web";
import { YAHTZEE_ANIMATION_SRC } from "@/constants/media";

export interface YahtzeeCelebrationProps {
  onDone: () => void;
}

/**
 * 화면 전체에 한 번 재생되는 야찌 컨페티. 재생이 끝나면 onDone을 호출해
 * 호출한 쪽이 활성 목록에서 이 연출을 지울 수 있게 한다. lottie-web은
 * DOM에 의존하므로 모듈 스코프가 아니라 effect 안에서 지연 로드한다.
 * @param props - 재생 완료 콜백
 * @param props.onDone
 * @returns 애니메이션이 그려질 컨테이너
 */
export const YahtzeeCelebration = ({ onDone }: YahtzeeCelebrationProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let anim: AnimationItem | null = null;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: YAHTZEE_ANIMATION_SRC,
      });
      anim.addEventListener("complete", onDone);
    });

    return (): void => {
      cancelled = true;
      anim?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
    />
  );
};
