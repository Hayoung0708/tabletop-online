"use client";

import { getSocket } from "@/lib/socket";

export interface UseShitheadActionsResult {
  selectFaceUp: (cardIds: string[]) => void;
  playCards: (cardIds: string[]) => void;
  playFaceDownCard: (index: number) => void;
  pickUpPile: () => void;
}

/**
 * 싯헤드 화면에서만 쓰는 소켓 액션들을 모아 둔다.
 * @returns 싯헤드 전용 액션 함수 모음
 */
export const useShitheadActions = (): UseShitheadActionsResult => {
  /**
   * 손패 6장 중 바닥패로 놓을 3장을 고른다.
   * @param cardIds - 바닥패로 놓을 카드 id 3개
   */
  const selectFaceUp = (cardIds: string[]): void => {
    getSocket().emit("shithead_select_face_up", { cardIds });
  };

  /**
   * 손패 또는 얼굴카드에서 같은 랭크 카드를 낸다.
   * @param cardIds - 내려는 카드 id들
   */
  const playCards = (cardIds: string[]): void => {
    getSocket().emit("shithead_play", { cardIds });
  };

  /**
   * 뒷카드를 한 장 뒤집어 낸다.
   * @param index - 뒤집을 뒷카드의 위치 (0부터)
   */
  const playFaceDownCard = (index: number): void => {
    getSocket().emit("shithead_play_face_down", { index });
  };

  /** 낼 카드가 없어서 더미 전체를 손패로 가져온다. */
  const pickUpPile = (): void => {
    getSocket().emit("shithead_pick_up_pile");
  };

  return { selectFaceUp, playCards, playFaceDownCard, pickUpPile };
};
