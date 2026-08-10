"use client";

import { useEffect, useRef, useState } from "react";
import { STARTER_TOAST_EXIT_MS, STARTER_TOAST_MS } from "@/constants/shithead";

export type StarterAnnouncePhase = "in" | "out";

export interface StarterAnnounceState {
  name: string;
  phase: StarterAnnouncePhase;
}

/**
 * 전원이 바닥패를 다 고른 순간(선택 단계 → 실제 플레이 전환)을 감지해서, 시작
 * 플레이어 이름과 지금 재생할 애니메이션 단계를 돌려준다. 등장(in) 키프레임이
 * 끝나고 잠시 떠 있다가 퇴장(out)으로 바뀌고, 퇴장이 끝나면 사라진다.
 * @param allSelected - 모든 플레이어가 바닥패 선택을 마쳤는지
 * @param starterName - 시작 플레이어 닉네임
 * @returns 표시할 이름과 애니메이션 단계, 표시할 게 없으면 null
 */
export const useStarterAnnounce = (
  allSelected: boolean,
  starterName: string,
): StarterAnnounceState | null => {
  const [state, setState] = useState<StarterAnnounceState | null>(null);
  const wasAllSelected = useRef(false);
  // 이름은 ref로 읽는다 — 의존성에 넣으면 토스트가 떠 있는 동안 턴이 넘어가
  // 이름이 바뀔 때마다 이펙트가 재실행되면서 퇴장 타이머만 지워지고(가드에
  // 걸려 새로 걸지도 않음) 토스트가 화면에서 영영 안 내려간다.
  const starterNameRef = useRef(starterName);
  useEffect(() => {
    starterNameRef.current = starterName;
  });

  useEffect(() => {
    if (!allSelected || wasAllSelected.current) {
      wasAllSelected.current = allSelected;
      return;
    }
    wasAllSelected.current = true;

    setState({ name: starterNameRef.current, phase: "in" });
    const toOut = setTimeout(() => {
      setState((prev) => (prev ? { ...prev, phase: "out" } : prev));
    }, STARTER_TOAST_MS);
    const toGone = setTimeout(
      () => setState(null),
      STARTER_TOAST_MS + STARTER_TOAST_EXIT_MS,
    );

    return (): void => {
      clearTimeout(toOut);
      clearTimeout(toGone);
    };
  }, [allSelected]);

  return state;
};
