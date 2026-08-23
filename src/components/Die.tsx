"use client";

import type { JSX } from "react";

/** 주사위 눈(1~6)별로 점을 찍을 3x3 그리드 칸 인덱스 */
const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export interface DieProps {
  value: number;
  held?: boolean;
  rolling?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * 클릭해서 홀드를 토글할 수 있는 주사위 한 개.
 * @param props - 주사위 표시/상호작용 옵션
 * @param props.value
 * @param props.held
 * @param props.rolling
 * @param props.onClick
 * @param props.disabled
 * @returns 주사위 버튼 엘리먼트
 */
export const Die = ({
  value,
  held,
  rolling,
  onClick,
  disabled,
}: DieProps): JSX.Element => {
  const pips = PIP_POSITIONS[value] ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={held}
      // 폭이 좁으면 주사위도 같이 작아진다 — 5개가 트레이 안에 항상 들어가야 한다.
      className={`die grid aspect-square w-[clamp(2.25rem,11vw,4rem)] shrink-0 grid-cols-3 grid-rows-3 gap-[3%] rounded-lg border-2 p-[7%] shadow transition-all duration-150 ${
        held
          ? "-translate-y-1 border-indigo-400 bg-indigo-50 shadow-indigo-500/50"
          : "border-slate-300 bg-white"
      } ${rolling ? "opacity-80" : ""} ${
        disabled ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"
      }`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="flex items-center justify-center">
          {pips.includes(i) && (
            <span
              className={`h-[70%] w-[70%] rounded-full ${
                held ? "bg-indigo-600" : "bg-slate-800"
              }`}
            />
          )}
        </span>
      ))}
    </button>
  );
};
