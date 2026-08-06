"use client";

import type { JSX } from "react";
import type { ToastMsg } from "@/hooks/useToast";

export interface ToastProps {
  toast: ToastMsg;
}

/**
 * 화면 하단 중앙에 잠깐 떴다 사라지는 토스트 배너.
 * @param props - 표시할 토스트
 * @param props.toast
 * @returns 토스트가 없으면 null, 있으면 배너 엘리먼트
 */
export const Toast = ({ toast }: ToastProps): JSX.Element | null => {
  if (!toast) return null;

  return (
    <div
      role="status"
      className={`pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
        toast.tone === "error" ? "bg-red-900 text-red-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      {toast.text}
    </div>
  );
};
