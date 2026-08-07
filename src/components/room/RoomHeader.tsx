"use client";

import type { JSX } from "react";
import { GAMES } from "@/constants/games";

export interface RoomHeaderProps {
  roomName: string;
  code: string;
  /** 현재 방의 게임 종류 id. 아직 상태를 못 받았으면 null (태그 숨김). */
  gameType: string | null;
  onCopyCode: () => void;
}

/**
 * 방 이름과, 클릭하면 복사되는 방 코드. 맨 오른쪽에 현재 진행 중인 게임 태그를 붙인다.
 * @param props - 방 이름/코드/게임 종류와 복사 핸들러
 * @param props.roomName
 * @param props.code
 * @param props.gameType
 * @param props.onCopyCode
 * @returns 헤더 엘리먼트
 */
export const RoomHeader = ({
  roomName,
  code,
  gameType,
  onCopyCode,
}: RoomHeaderProps): JSX.Element => {
  const game = GAMES.find((g) => g.id === gameType);

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
      {game && (
        <span className="ml-auto shrink-0 rounded-full border border-indigo-500 bg-indigo-950 px-3 py-1 text-sm font-medium text-indigo-200">
          {game.label}
        </span>
      )}
    </div>
  );
};
