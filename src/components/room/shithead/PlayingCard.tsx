"use client";

import type { JSX } from "react";
import type { Card } from "@/server/shithead/deck";

const SUIT_SYMBOL: Record<Card["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

const RED_SUITS: readonly Card["suit"][] = ["diamonds", "hearts"];

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const CARD_BASE_CLASS =
  "flex h-20 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-2 text-lg font-bold shadow transition-all duration-150 sm:h-24 sm:w-16";

/**
 * 카드 한 장. card가 없거나 faceDown이면 뒷면을 보여준다.
 * @param props - 카드 데이터와 클릭 옵션
 * @param props.card
 * @param props.faceDown
 * @param props.selected
 * @param props.onClick
 * @param props.disabled
 * @returns 카드 엘리먼트
 */
export const PlayingCard = ({
  card,
  faceDown,
  selected,
  onClick,
  disabled,
}: PlayingCardProps): JSX.Element => {
  const disabledClass = disabled ? "opacity-30 grayscale contrast-75" : "";

  if (faceDown || !card) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className={`${CARD_BASE_CLASS} border-indigo-700 bg-indigo-900 bg-[repeating-linear-gradient(45deg,theme(colors.indigo.800),theme(colors.indigo.800)_4px,theme(colors.indigo.900)_4px,theme(colors.indigo.900)_8px)] ${disabledClass} ${
          onClick && !disabled ? "cursor-pointer hover:-translate-y-1" : "cursor-default"
        }`}
      />
    );
  }

  const isRed = RED_SUITS.includes(card.suit);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${CARD_BASE_CLASS} bg-white ${isRed ? "text-red-600" : "text-slate-900"} ${disabledClass} ${
        selected
          ? "-translate-y-2 border-indigo-400 shadow-indigo-500/50"
          : "border-slate-300"
      } ${onClick && !disabled ? "cursor-pointer hover:-translate-y-1" : "cursor-default"}`}
    >
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
};
