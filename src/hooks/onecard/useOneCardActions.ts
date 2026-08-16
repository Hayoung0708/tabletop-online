"use client";

import { getSocket } from "@/lib/socket";
import type { Suit } from "@/server/shithead/deck";

export interface UseOneCardActionsResult {
  playCard: (cardId: string, suit?: Suit) => void;
  drawCards: () => void;
  callOneCard: () => void;
}

/**
 * 원카드 화면에서만 쓰는 소켓 액션들을 모아 둔다.
 * @returns 원카드 전용 액션 함수 모음
 */
export const useOneCardActions = (): UseOneCardActionsResult => {
  /**
   * 고른 카드를 낸다.
   * @param cardId - 내려는 카드 id
   * @param suit - 7을 낼 때 지정할 무늬
   */
  const playCard = (cardId: string, suit?: Suit): void => {
    getSocket().emit("onecard_play", { cardId, suit });
  };

  /** 낼 카드가 없어서(또는 공격을 못 막아서) 덱에서 카드를 먹는다. */
  const drawCards = (): void => {
    getSocket().emit("onecard_draw");
  };

  /**
   * "원카드"를 외친다. 한 장 남은 당사자가 누르면 성공, 다른 사람이 먼저
   * 누르면 지적이 되어 당사자가 벌칙을 받는다.
   */
  const callOneCard = (): void => {
    getSocket().emit("onecard_call");
  };

  return { playCard, drawCards, callOneCard };
};
