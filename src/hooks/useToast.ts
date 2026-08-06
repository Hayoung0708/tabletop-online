"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export type ToastMsg = { text: string; tone?: "ok" | "error" } | null;

const DEFAULT_TOAST_DURATION_MS = 2200;

/**
 * 일정 시간 뒤 자동으로 사라지는 토스트 메시지 상태를 관리한다.
 * @param durationMs - 토스트가 화면에 머무는 시간(ms)
 * @returns [현재 토스트, 토스트 설정 함수] 튜플
 */
export const useToast = (
  durationMs: number = DEFAULT_TOAST_DURATION_MS,
): readonly [ToastMsg, Dispatch<SetStateAction<ToastMsg>>] => {
  const [toast, setToast] = useState<ToastMsg>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return (): void => clearTimeout(timer);
  }, [toast, durationMs]);

  return [toast, setToast] as const;
};
