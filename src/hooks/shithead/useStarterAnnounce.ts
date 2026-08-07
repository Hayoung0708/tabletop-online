"use client";

import { useEffect, useRef, useState } from "react";
import { STARTER_TOAST_MS } from "@/constants/shithead";

/**
 * 전원이 바닥패를 다 고른 순간(선택 단계 → 실제 플레이 전환)을 감지해서, 시작
 * 플레이어 이름을 잠깐 보여줄 값으로 돌려준다. 그 순간 한 번만 뜨고 곧 사라진다.
 * @param allSelected - 모든 플레이어가 바닥패 선택을 마쳤는지
 * @param starterName - 시작 플레이어 닉네임
 * @returns 보여줄 시작 플레이어 이름, 없으면 null
 */
export const useStarterAnnounce = (
  allSelected: boolean,
  starterName: string,
): string | null => {
  const [name, setName] = useState<string | null>(null);
  const wasAllSelected = useRef(false);

  useEffect(() => {
    if (!allSelected || wasAllSelected.current) {
      wasAllSelected.current = allSelected;
      return;
    }
    wasAllSelected.current = true;
    const raf = requestAnimationFrame(() => setName(starterName));
    const timer = setTimeout(() => setName(null), STARTER_TOAST_MS);
    return (): void => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [allSelected, starterName]);

  return name;
};
