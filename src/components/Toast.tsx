"use client";

import { useEffect, useState } from "react";

export type ToastMsg = { text: string; tone?: "ok" | "error" } | null;

export function useToast(ms = 2200) {
  const [toast, setToast] = useState<ToastMsg>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);

  return [toast, setToast] as const;
}

export function Toast({ toast }: { toast: ToastMsg }) {
  if (!toast) return null;

  return (
    <div
      role="status"
      className={`pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
        toast.tone === "error"
          ? "bg-red-900 text-red-100"
          : "bg-slate-100 text-slate-900"
      }`}
    >
      {toast.text}
    </div>
  );
}
