"use client";

import { useEffect, useRef, useState } from "react";
import { STARTER_TOAST_EXIT_MS, STARTER_TOAST_MS } from "@/constants/shithead";

export type StarterAnnouncePhase = "in" | "out";

/** 토스트 진행 단계. idle은 아직 안 띄운 상태, done은 다 보여준 상태. */
type ToastPhase = "idle" | StarterAnnouncePhase | "done";

export interface StarterAnnounceState {
  name: string;
  phase: StarterAnnouncePhase;
}

/**
 * 게임이 시작된 순간을 감지해서, 시작 플레이어 이름과 지금 재생할 애니메이션
 * 단계를 돌려준다. 등장(in) 뒤 잠시 떠 있다가 퇴장(out)으로 바뀌고, 퇴장이
 * 끝나면 사라진다.
 *
 * 타이머는 오직 현재 단계(phase)에만 의존한다 — 트리거 값에 걸어 두면,
 * 트리거가 다시 false가 되거나(원카드는 첫 수를 두면 바로 false다) 개발 모드
 * StrictMode가 이펙트를 두 번 실행할 때 클린업이 퇴장 타이머를 지워버려
 * 토스트가 화면에 영영 남는다.
 * @param started - 게임이 막 시작됐는지 (싯헤드는 바닥패 선택 완료 시점)
 * @param starterName - 시작 플레이어 닉네임
 * @returns 표시할 이름과 애니메이션 단계, 표시할 게 없으면 null
 */
export const useStarterAnnounce = (
  started: boolean,
  starterName: string,
): StarterAnnounceState | null => {
  const [phase, setPhase] = useState<ToastPhase>("idle");
  const [name, setName] = useState("");
  // 이름은 ref로 읽는다 — 토스트가 떠 있는 동안 턴이 넘어가 이름이 바뀌어도
  // 처음 잡은 시작 플레이어를 그대로 보여줘야 한다.
  const starterNameRef = useRef(starterName);
  useEffect(() => {
    starterNameRef.current = starterName;
  });

  useEffect(() => {
    if (started && phase === "idle") {
      setName(starterNameRef.current);
      setPhase("in");
      return;
    }
    // 한 판이 끝나 트리거가 내려가면 다음 판을 위해 되돌려 둔다.
    if (!started && phase === "done") setPhase("idle");
  }, [started, phase]);

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

  if (phase !== "in" && phase !== "out") return null;
  return { name, phase };
};
