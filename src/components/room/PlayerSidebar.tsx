"use client";

import type { JSX } from "react";
import { CrownIcon, DisconnectedIcon } from "@/components/icons/RoomIcons";
import type { PublicRoomState } from "@/server/roomManager";

export interface PlayerSidebarProps {
  players: PublicRoomState["players"];
  currentPlayerId: string | null;
  hostId: string;
  /** 각 플레이어 이름 아래에 보여줄 추가 정보 (점수, 남은 카드 수 등). 없으면 안 보여줌. */
  extraLine?: (userId: string) => string | null;
  onSendEmote: () => void;
}

/**
 * 왼쪽에 고정된 참가자 목록 + 감정표현 버튼.
 * @param props - 참가자 정보와 감정표현 전송 핸들러
 * @param props.players
 * @param props.currentPlayerId
 * @param props.hostId
 * @param props.extraLine
 * @param props.onSendEmote
 * @returns 사이드바 엘리먼트
 */
export const PlayerSidebar = ({
  players,
  currentPlayerId,
  hostId,
  extraLine,
  onSendEmote,
}: PlayerSidebarProps): JSX.Element => {
  return (
    <aside className="hidden w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-800 px-4 py-4 sm:flex">
      {players.map((p) => {
        const extra = extraLine?.(p.userId) ?? null;
        return (
          <div
            key={p.userId}
            className={`flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-base transition ${
              p.userId === currentPlayerId
                ? "border-indigo-500 bg-indigo-600"
                : "border-slate-800 bg-slate-900/60"
            } ${p.connected ? "" : "opacity-40"}`}
          >
            <div className="flex items-center gap-2">
              {p.userId === hostId && (
                <CrownIcon className="h-4 w-4 shrink-0 text-yellow-300" />
              )}
              <span className="truncate font-medium">{p.nickname}</span>
              {!p.connected && (
                <DisconnectedIcon className="h-4 w-4 shrink-0 text-red-300" />
              )}
            </div>
            {extra && <span className="text-slate-200">{extra}</span>}
          </div>
        );
      })}
      <div className="mt-auto flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-400">감정표현</span>
        <button
          onClick={onSendEmote}
          title="감정표현"
          className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-2xl transition hover:bg-slate-800"
        >
          ❓
        </button>
      </div>
    </aside>
  );
};
