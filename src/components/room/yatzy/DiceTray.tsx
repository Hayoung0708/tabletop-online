"use client";

import type { JSX } from "react";
import { Die } from "@/components/Die";

export interface DiceTrayProps {
  dice: number[];
  held: boolean[];
  rollingMask: boolean[];
  randomFaces: number[];
  rollsLeft: number;
  isMyTurn: boolean;
  hasRolled: boolean;
  isRolling: boolean;
  onToggleHold: (dieIndex: number) => void;
  onRoll: () => void;
}

/**
 * 주사위 5개와 굴리기 버튼.
 * @param props - 주사위 상태와 조작 핸들러
 * @param props.dice
 * @param props.held
 * @param props.rollingMask
 * @param props.randomFaces
 * @param props.rollsLeft
 * @param props.isMyTurn
 * @param props.hasRolled
 * @param props.isRolling
 * @param props.onToggleHold
 * @param props.onRoll
 * @returns 주사위 트레이 엘리먼트
 */
export const DiceTray = ({
  dice,
  held,
  rollingMask,
  randomFaces,
  rollsLeft,
  isMyTurn,
  hasRolled,
  isRolling,
  onToggleHold,
  onRoll,
}: DiceTrayProps): JSX.Element => {
  const canToggleHold = isMyTurn && hasRolled;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex gap-3 sm:gap-4">
        {dice.map((value, i) => (
          <Die
            key={i}
            value={rollingMask[i] ? randomFaces[i] : value}
            held={held[i]}
            rolling={rollingMask[i]}
            onClick={() => canToggleHold && onToggleHold(i)}
            disabled={!canToggleHold}
          />
        ))}
      </div>
      <button
        onClick={onRoll}
        disabled={!isMyTurn || rollsLeft <= 0 || isRolling}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-base font-medium transition hover:bg-indigo-500 disabled:opacity-40"
      >
        주사위 굴리기 ({rollsLeft}/3)
      </button>
    </div>
  );
};
