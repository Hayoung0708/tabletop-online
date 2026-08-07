"use client";

import type { JSX } from "react";
import { Club, Diamond, Heart, Spade } from "lucide-react";
import type { Card } from "@/server/shithead/deck";

const SUIT_ICON: Record<Card["suit"], typeof Club> = {
  clubs: Club,
  diamonds: Diamond,
  hearts: Heart,
  spades: Spade,
};

const RED_SUITS: readonly Card["suit"][] = ["diamonds", "hearts"];

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "normal" | "large";
}

const CARD_BASE_CLASS =
  "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 font-bold shadow transition-all duration-150";

// large는 normal을 1.25배한 치수 — 브레이크포인트별 가로세로 비율을 normal과
// 똑같이 맞춰서(0.70 / 0.667) 덱·더미 카드가 손패 카드와 같은 비율로 보이게 한다.
const SIZE_CLASS: Record<NonNullable<PlayingCardProps["size"]>, string> = {
  normal: "h-20 w-14 text-lg sm:h-24 sm:w-16",
  large: "h-[6.25rem] w-[4.375rem] text-xl sm:h-[7.5rem] sm:w-20",
};

const FACE_DOWN_ACTIVE_CLASS =
  "border-indigo-700 bg-indigo-900 bg-[repeating-linear-gradient(45deg,theme(colors.indigo.800),theme(colors.indigo.800)_4px,theme(colors.indigo.900)_4px,theme(colors.indigo.900)_8px)]";
const FACE_DOWN_DISABLED_CLASS =
  "border-slate-600 bg-slate-700 bg-[repeating-linear-gradient(45deg,theme(colors.slate.600),theme(colors.slate.600)_4px,theme(colors.slate.700)_4px,theme(colors.slate.700)_8px)]";

/**
 * 카드 한 장. card가 없거나 faceDown이면 뒷면을 보여준다. 낼 수 없는
 * 카드는 색 자체를 회색 계열로 바꿔서 표시한다 (opacity/grayscale
 * 필터를 쓰면 카드가 겹쳤을 때 아래 카드가 비쳐 보여서, 불투명한 회색
 * 팔레트로 통째로 바꾸는 방식을 쓴다).
 * @param props - 카드 데이터와 클릭 옵션
 * @param props.card
 * @param props.faceDown
 * @param props.selected
 * @param props.onClick
 * @param props.disabled
 * @param props.size
 * @returns 카드 엘리먼트
 */
export const PlayingCard = ({
  card,
  faceDown,
  selected,
  onClick,
  disabled,
  size = "normal",
}: PlayingCardProps): JSX.Element => {
  const sizeClass = SIZE_CLASS[size];

  if (faceDown || !card) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className={`${CARD_BASE_CLASS} ${sizeClass} ${disabled ? FACE_DOWN_DISABLED_CLASS : FACE_DOWN_ACTIVE_CLASS} ${
          onClick && !disabled ? "cursor-pointer hover:-translate-y-1" : "cursor-default"
        }`}
      />
    );
  }

  const isRed = RED_SUITS.includes(card.suit);
  const SuitIcon = SUIT_ICON[card.suit];

  // border-* 유틸리티는 하나만 넣어야 한다 — 두 개를 동시에 넣으면(예:
  // border-slate-300 border-[#432dd7]) Tailwind가 어느 걸 우선할지 보장이
  // 안 돼서 선택 표시 색이 안 먹힐 수 있다.
  const textClass = isRed ? "text-red-600" : "text-slate-900";
  const colorClass = disabled
    ? isRed
      ? "border-slate-400 bg-slate-300 text-red-800"
      : "border-slate-400 bg-slate-300 text-slate-800"
    : selected
      ? `border-indigo-500 bg-white -translate-y-2 ${textClass}`
      : `border-slate-300 bg-white ${textClass}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${CARD_BASE_CLASS} ${sizeClass} ${colorClass} ${
        onClick && !disabled ? "cursor-pointer hover:-translate-y-1" : "cursor-default"
      }`}
    >
      <span>{card.rank}</span>
      <SuitIcon
        className={size === "large" ? "h-5 w-5" : "h-4 w-4"}
        fill="currentColor"
      />
    </button>
  );
};
