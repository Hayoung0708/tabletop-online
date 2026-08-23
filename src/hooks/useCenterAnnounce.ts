"use client";

import { useCallback, useEffect, useState } from "react";
import { STARTER_TOAST_EXIT_MS, STARTER_TOAST_MS } from "@/constants/shithead";

export type CenterAnnouncePhase = "in" | "out";

/** 토스트 진행 단계. idle은 아직 안 띄운 상태, done은 다 보여준 상태. */
type ToastPhase = "idle" | CenterAnnouncePhase | "done";

export interface CenterAnnounceState {
  text: string;
  phase: CenterAnnouncePhase;
}

export interface UseCenterAnnounceResult {
  announce: CenterAnnounceState | null;
  showAnnounce: (text: string) => void;
}

/**
 * 화면 가운데에 잠깐 떴다 사라지는 안내 토스트 상태를 관리한다. 등장(in) 뒤
 * 잠시 떠 있다가 퇴장(out)으로 바뀌고, 퇴장이 끝나면 사라진다.
 *
 * 타이머는 오직 현재 단계(phase)에만 의존한다 — 바깥 값에 걸어 두면 그 값이
 * 바뀌거나 개발 모드 StrictMode가 이펙트를 두 번 실행할 때 클린업이 퇴장
 * 타이머를 지워버려 토스트가 화면에 영영 남는다.
 * @returns 지금 보여줄 안내와, 새 안내를 띄우는 함수
 */
export const useCenterAnnounce = (): UseCenterAnnounceResult => {
  const [phase, setPhase] = useState<ToastPhase>("idle");
  const [text, setText] = useState("");

  const showAnnounce = useCallback((next: string): void => {
    setText(next);
    setPhase("in");
  }, []);

  useEffect(() => {
    if (phase === "in") {
      const timer = setTimeout(() => setPhase("out"), STARTER_TOAST_MS);
      return (): void => clearTimeout(timer);
    }
    if (phase === "out") {
      const timer = setTimeout(() => setPhase("done"), STARTER_TOAST_EXIT_MS);
      return (): void => clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  const announce = phase === "in" || phase === "out" ? { text, phase } : null;
  return { announce, showAnnounce };
};
