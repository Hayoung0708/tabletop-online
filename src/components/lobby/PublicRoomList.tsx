"use client";

import type { JSX } from "react";
import { GAMES } from "@/constants/games";
import type { RoomSummary } from "@/utils/roomApi";

export interface PublicRoomListProps {
  rooms: RoomSummary[];
  onJoin: (code: string) => void;
}

/**
 * 공개 방 목록. 비어 있으면 안내 문구만 보여준다.
 * @param props - 방 목록과 참가 핸들러
 * @param props.rooms
 * @param props.onJoin
 * @returns 목록 엘리먼트
 */
export const PublicRoomList = ({ rooms, onJoin }: PublicRoomListProps): JSX.Element => {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">공개 방</h2>
      {rooms.length === 0 && (
        <p className="text-sm text-slate-500">공개된 방이 없습니다.</p>
      )}
      <ul className="flex flex-col gap-2">
        {rooms.map((room) => (
          <li
            key={room.code}
            className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                <span className="truncate">{room.name}</span>
                <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-normal text-slate-400">
                  {GAMES.find((g) => g.id === room.gameType)?.label ?? room.gameType}
                </span>
              </p>
              <p className="truncate text-sm text-slate-400">
                {room.playerCount}/{room.maxPlayers}명 ·{" "}
                {room.nicknames.filter(Boolean).join(", ")}
              </p>
            </div>
            <button
              onClick={() => onJoin(room.code)}
              disabled={room.playerCount >= room.maxPlayers}
              className="ml-3 shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-40"
            >
              참가
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
