"use client";

import type { JSX } from "react";

const MIN_JOIN_CODE_LENGTH = 4;
const ROOM_CODE_LENGTH = 6;

export interface JoinByCodeCardProps {
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoin: (code: string) => void;
}

/**
 * 방 코드를 직접 입력해 참가하는 카드.
 * @param props - 입력값과 변경/참가 핸들러
 * @param props.joinCode
 * @param props.onJoinCodeChange
 * @param props.onJoin
 * @returns 카드 엘리먼트
 */
export const JoinByCodeCard = ({
  joinCode,
  onJoinCodeChange,
  onJoin,
}: JoinByCodeCardProps): JSX.Element => {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-5">
      <h2 className="text-lg font-semibold">코드로 참가하기</h2>
      <div className="flex gap-2">
        <input
          value={joinCode}
          onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
          placeholder="방 코드 입력"
          maxLength={ROOM_CODE_LENGTH}
          className="flex-1 rounded-lg bg-slate-800 px-4 py-2.5 tracking-widest uppercase outline-none ring-1 ring-slate-700 focus:ring-indigo-500"
        />
        <button
          onClick={() => joinCode && onJoin(joinCode)}
          disabled={joinCode.length < MIN_JOIN_CODE_LENGTH}
          className="rounded-lg bg-slate-700 px-4 py-2.5 font-medium transition hover:bg-slate-600 disabled:opacity-50"
        >
          참가
        </button>
      </div>
    </section>
  );
};
