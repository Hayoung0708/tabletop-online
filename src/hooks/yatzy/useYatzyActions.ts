"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import { YATZY_ROLL_PENDING_TIMEOUT_MS } from "@/constants/yatzy";
import type { Category } from "@/utils/yatzy";

export interface UseYatzyActionsResult {
  rollDice: () => void;
  toggleHold: (dieIndex: number) => void;
  scoreCategory: (category: Category) => void;
  isRollPending: boolean;
}

/**
 * 야찌 화면에서만 쓰는 소켓 액션들을 모아 둔다.
 *
 * 굴리기는 응답이 오기 전에 한 번 더 눌리면 서버가 두 번 처리하므로, 요청을 보낸
 * 시점의 rollsLeft를 기억해 두고 서버 상태가 바뀔 때까지 추가 emit을 막는다.
 * 버튼 disabled(UI)와 별개로 emit 자체를 막는 층이다.
 * @param rollsLeft - 현재 서버 상태의 남은 굴림 횟수
 * @returns 야찌 전용 액션 함수 모음과 굴리기 응답 대기 여부
 */
export const useYatzyActions = (rollsLeft: number): UseYatzyActionsResult => {
  const [pendingRollsLeft, setPendingRollsLeft] = useState<number | null>(null);

  // 서버 상태가 바뀌었다는 것은 요청이 처리됐다는 뜻이다. 다음 턴에 같은 rollsLeft가
  // 다시 오더라도 이전 요청으로 오인하지 않도록 렌더 중에 바로 비운다.
  if (pendingRollsLeft !== null && pendingRollsLeft !== rollsLeft) {
    setPendingRollsLeft(null);
  }
  const isRollPending = pendingRollsLeft === rollsLeft;

  // 서버가 요청을 거절하면 상태가 바뀌지 않아 잠금이 영영 남는다. 예비 타임아웃으로 푼다.
  useEffect(() => {
    if (!isRollPending) return;
    const timeout = setTimeout(
      () => setPendingRollsLeft(null),
      YATZY_ROLL_PENDING_TIMEOUT_MS,
    );
    return (): void => clearTimeout(timeout);
  }, [isRollPending]);

  /** 주사위를 굴린다. 직전 요청의 응답이 아직 안 왔으면 보내지 않는다. */
  const rollDice = (): void => {
    if (isRollPending) return;
    setPendingRollsLeft(rollsLeft);
    getSocket().emit("roll_dice");
  };

  /**
   * 주사위 하나의 홀드 여부를 뒤집는다.
   * @param dieIndex - 대상 주사위 인덱스
   */
  const toggleHold = (dieIndex: number): void => {
    getSocket().emit("toggle_hold", { dieIndex });
  };

  /**
   * 현재 주사위 값을 지정한 항목에 채운다.
   * @param category - 채울 항목
   */
  const scoreCategory = (category: Category): void => {
    getSocket().emit("score_category", { category });
  };

  return { rollDice, toggleHold, scoreCategory, isRollPending };
};
