"use client";

import type { JSX } from "react";
import { Club, Diamond, Drama, Heart, Spade } from "lucide-react";
import { CARD_SIZE_CLASS } from "@/constants/card";
import type { Suit } from "@/server/shithead/deck";

const SUIT_ICON: Record<Suit, typeof Club> = {
  clubs: Club,
  diamonds: Diamond,
  hearts: Heart,
  spades: Spade,
};

const RED_SUITS: readonly Suit[] = ["diamonds", "hearts"];

/**
 * 화면에 그릴 수 있는 카드 모양 — 싯헤드 카드는 그대로 맞고, 원카드의
 * 조커(rank "JOKER", suit null)도 허용한다.
 */
export interface DisplayCard {
  id: string;
  rank: string;
  suit: Suit | null;
}

export interface PlayingCardProps {
  card?: DisplayCard;
  faceDown?: boolean;
  selected?: boolean;
  /** 꼭 써야 하는 카드처럼 시선을 끌어야 할 때 테두리를 강조한다. */
  highlighted?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const CARD_BASE_CLASS =
  // transition은 transform에만 건다 — 색까지 전이시키면 더미 맨 위 카드가
  // 빨강↔검정으로 바뀔 때 이전 색이 잠깐 남아 반대 색으로 반짝인다.
  "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 font-bold shadow transition-transform duration-150";

// 카드는 어디서나 같은 크기다 — 덱/더미만 크게 그리면 손패에서 날아갈 때
// 확대·축소가 필요해지고, 글자와 아이콘 비율이 미묘하게 달라 티가 난다.
const SIZE_CLASS = `${CARD_SIZE_CLASS} text-base sm:text-lg`;

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
 * @param props.highlighted - 테두리를 강조할지
 * @param props.onClick
 * @param props.disabled
 * @returns 카드 엘리먼트
 */
export const PlayingCard = ({
  card,
  faceDown,
  selected,
  highlighted,
  onClick,
  disabled,
}: PlayingCardProps): JSX.Element => {
  const sizeClass = SIZE_CLASS;
  // ring은 border와 겹치지 않아 선택 표시(테두리 색)를 덮어쓰지 않는다.
  const highlightClass = highlighted ? " ring-2 ring-amber-400" : "";

  if (faceDown || !card) {
    return (
      <button
        type="button"
        onClick={onClick}
        // onClick이 없다고 HTML disabled로 두면 포인터 이벤트가 아예 안 와서
        // 내 차례가 아닐 때 카드를 끌 수 없다. 진짜 못 내는 카드만 막는다.
        disabled={disabled}
        className={`${CARD_BASE_CLASS} ${sizeClass}${highlightClass} ${disabled ? FACE_DOWN_DISABLED_CLASS : FACE_DOWN_ACTIVE_CLASS} ${
          onClick && !disabled
            ? "cursor-pointer hover:-translate-y-1"
            : "cursor-[inherit]"
        }`}
      />
    );
  }

  const isRed = card.suit !== null && RED_SUITS.includes(card.suit);
  const SuitIcon = card.suit !== null ? SUIT_ICON[card.suit] : null;
  const isJoker = card.rank === "JOKER";

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
      data-card-id={card.id}
      onClick={onClick}
      disabled={disabled}
      className={`${CARD_BASE_CLASS} ${sizeClass}${highlightClass} ${colorClass} ${
        onClick && !disabled ? "cursor-pointer hover:-translate-y-1" : "cursor-[inherit]"
      }`}
    >
      {isJoker ? (
        <>
          <Drama className="h-6 w-6" />
          <span className="text-[0.6rem] tracking-tight">JOCKER</span>
        </>
      ) : (
        <span>{card.rank}</span>
      )}
      {SuitIcon && <SuitIcon className="h-4 w-4" fill="currentColor" />}
    </button>
  );
};
