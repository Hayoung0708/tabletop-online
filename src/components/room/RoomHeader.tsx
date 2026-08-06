"use client";

import type { JSX } from "react";

export interface RoomHeaderProps {
  roomName: string;
  code: string;
  onCopyCode: () => void;
}

/**
 * 방 이름과, 클릭하면 복사되는 방 코드.
 * @param props - 방 이름/코드와 복사 핸들러
 * @param props.roomName
 * @param props.code
 * @param props.onCopyCode
 * @returns 헤더 엘리먼트
 */
export const RoomHeader = ({
  roomName,
  code,
  onCopyCode,
}: RoomHeaderProps): JSX.Element => {
  return (
    <div className="flex items-center gap-3">
      <h1 className="truncate text-xl font-bold">{roomName}</h1>
      <button
        onClick={onCopyCode}
        title="클릭하면 방 코드가 복사됩니다"
        className="flex items-center gap-1.5 rounded font-mono text-sm tracking-widest text-slate-400 transition hover:text-slate-100"
      >
        {code}
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      </button>
    </div>
  );
};
