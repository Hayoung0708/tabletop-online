"use client";

import { getSocket } from "@/lib/socket";
import type { Category } from "@/utils/yatzy";

export interface UseYatzyActionsResult {
  rollDice: () => void;
  toggleHold: (dieIndex: number) => void;
  scoreCategory: (category: Category) => void;
}

/**
 * 야찌 화면에서만 쓰는 소켓 액션들을 모아 둔다.
 * @returns 야찌 전용 액션 함수 모음
 */
export const useYatzyActions = (): UseYatzyActionsResult => {
  /** 주사위를 굴린다. */
  const rollDice = (): void => {
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

  return { rollDice, toggleHold, scoreCategory };
};
