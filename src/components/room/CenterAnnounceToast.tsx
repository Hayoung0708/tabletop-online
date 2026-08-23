"use client";

import type { CSSProperties, JSX } from "react";
import type { CenterAnnounceState } from "@/hooks/useCenterAnnounce";
import { STARTER_TOAST_ENTER_MS, STARTER_TOAST_EXIT_MS } from "@/constants/shithead";

/** 단계별로 쓸 animate.css 클래스와 재생 시간. */
const PHASE_ANIMATION = {
  in: { className: "animate__bounceInUp", durationMs: STARTER_TOAST_ENTER_MS },
  out: { className: "animate__bounceOutDown", durationMs: STARTER_TOAST_EXIT_MS },
} as const;

export interface CenterAnnounceToastProps {
  announce: CenterAnnounceState | null;
}

/**
 * 화면 중앙에 잠깐 뜨는 안내 토스트. animate.css의 bounceInUp으로 아래에서
 * 튀어 올라오고(in), bounceOutDown으로 아래로 튀어 내려가며 사라진다(out).
 * 시작 플레이어 안내, 원카드 외치기 결과 등이 같은 모양을 쓴다.
 * @param props - 표시할 문구와 애니메이션 단계
 * @param props.announce
 * @returns 토스트 엘리먼트, 표시할 게 없으면 null
 */
export const CenterAnnounceToast = ({
  announce,
}: CenterAnnounceToastProps): JSX.Element | null => {
  if (!announce) return null;
  const { text, phase } = announce;
  const { className, durationMs } = PHASE_ANIMATION[phase];

  // animate.css는 재생 시간을 --animate-duration 변수로 받는다.
  const style: CSSProperties = {
    ["--animate-duration" as string]: `${durationMs}ms`,
  };

  return (
    // z-[60]: 상대 손패 컨테이너(z-50, 비행 오버레이보다 위)보다도 위에 떠야 한다.
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className={`animate__animated ${className} rounded-2xl bg-slate-900/90 px-8 py-5 text-2xl font-bold text-indigo-200 shadow-xl ring-1 ring-indigo-500`}
        style={style}
      >
        {text}
      </div>
    </div>
  );
};
