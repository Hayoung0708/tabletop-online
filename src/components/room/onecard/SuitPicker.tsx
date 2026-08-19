"use client";

import type { JSX } from "react";
import { Club, Diamond, Heart, Spade } from "lucide-react";
import { SUITS, type Suit } from "@/server/shithead/deck";

export interface SuitPickerProps {
  onPick: (suit: Suit) => void;
  onCancel: () => void;
}

const SUIT_ICON: Record<Suit, typeof Club> = {
  clubs: Club,
  diamonds: Diamond,
  hearts: Heart,
  spades: Spade,
};

const RED_SUITS: readonly Suit[] = ["diamonds", "hearts"];

/**
 * 7을 낼 때 바꿀 무늬를 고르는 오버레이. 무늬 4개 중 하나를 클릭하면
 * 선택되고, 바깥을 클릭하면 취소된다.
 * @param props - 선택/취소 콜백
 * @param props.onPick
 * @param props.onCancel
 * @returns 무늬 선택 오버레이 엘리먼트
 */
export const SuitPicker = ({ onPick, onCancel }: SuitPickerProps): JSX.Element => {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-2xl bg-slate-900 px-6 py-5 ring-1 ring-indigo-500"
        onClick={(e): void => e.stopPropagation()}
      >
        <p className="text-lg font-bold text-slate-200">바꿀 무늬를 선택하세요</p>
        <div className="flex gap-2">
          {SUITS.map((suit) => {
            const Icon = SUIT_ICON[suit];
            return (
              <button
                key={suit}
                type="button"
                onClick={(): void => onPick(suit)}
                className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 border-slate-300 bg-white transition hover:-translate-y-1 ${
                  RED_SUITS.includes(suit) ? "text-red-600" : "text-slate-900"
                }`}
              >
                <Icon className="h-7 w-7" fill="currentColor" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
