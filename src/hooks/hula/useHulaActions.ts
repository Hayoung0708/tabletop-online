"use client";

import { getSocket } from "@/lib/socket";
import type { HulaDrawSource } from "@/server/hula/gameLogic";

export interface UseHulaActionsResult {
  drawCard: (source: HulaDrawSource) => void;
  registerMeld: (cardIds: string[]) => void;
  appendCard: (meldId: string, cardId: string) => void;
  discardCard: (cardId: string) => void;
  cancelThankYou: () => void;
  callStop: () => void;
}

/**
 * 훌라 화면에서만 쓰는 소켓 액션들을 모아 둔다.
 * @returns 훌라 전용 액션 함수 모음
 */
export const useHulaActions = (): UseHulaActionsResult => {
  /**
   * 덱 또는 더미에서 카드를 한 장 가져온다.
   * @param source - 가져올 곳
   */
  const drawCard = (source: HulaDrawSource): void => {
    getSocket().emit("hula_draw", { source });
  };

  /**
   * 고른 카드들로 조합을 등록한다.
   * @param cardIds - 등록할 카드 id 목록
   */
  const registerMeld = (cardIds: string[]): void => {
    getSocket().emit("hula_meld", { cardIds });
  };

  /**
   * 이미 등록된 조합에 카드 한 장을 붙인다.
   * @param meldId - 붙일 조합 id
   * @param cardId - 붙일 카드 id
   */
  const appendCard = (meldId: string, cardId: string): void => {
    getSocket().emit("hula_append", { meldId, cardId });
  };

  /**
   * 카드 한 장을 버리고 차례를 넘긴다.
   * @param cardId - 버릴 카드 id
   */
  const discardCard = (cardId: string): void => {
    getSocket().emit("hula_discard", { cardId });
  };

  /** 땡큐를 취소하고 차례를 원래 사람에게 돌려준다. */
  const cancelThankYou = (): void => {
    getSocket().emit("hula_cancel_thankyou");
  };

  /** 스톱을 선언한다. */
  const callStop = (): void => {
    getSocket().emit("hula_stop");
  };

  return { drawCard, registerMeld, appendCard, discardCard, cancelThankYou, callStop };
};
