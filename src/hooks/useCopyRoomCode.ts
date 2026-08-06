"use client";

import { useEffect, useState } from "react";

const COPIED_BADGE_DURATION_MS = 1600;

export interface UseCopyRoomCodeResult {
  copied: boolean;
  copyCode: () => Promise<void>;
}

/**
 * 방 코드를 클립보드에 복사하고, 잠깐 "복사되었습니다" 배지를 띄운다.
 * @param code - 복사할 방 코드
 * @returns 복사 상태와 복사 실행 함수
 */
export const useCopyRoomCode = (code: string): UseCopyRoomCodeResult => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_BADGE_DURATION_MS);
    return (): void => clearTimeout(timer);
  }, [copied]);

  /** 방 코드를 클립보드에 복사한다. */
  const copyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // 클립보드 권한이 막혀 있으면 조용히 무시 — 코드는 이미 화면에 보여서 손으로 복사 가능.
    }
  };

  return { copied, copyCode };
};
