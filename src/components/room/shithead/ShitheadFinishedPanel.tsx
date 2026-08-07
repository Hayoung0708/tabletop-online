"use client";

import type { JSX } from "react";
import type { PublicShitheadPlayer } from "@/server/shithead/gameLogic";
import type { PublicRoomState } from "@/server/roomManager";

export interface ShitheadFinishedPanelProps {
  players: PublicRoomState["players"];
  shitheadPlayers: PublicShitheadPlayer[];
  onLeaveRoom: () => void;
}

/**
 * 게임 종료 후 등수표. 1등부터 마지막(싯헤드)까지 순서대로 보여준다.
 * @param props - 참가자 정보와 로비 이동 핸들러
 * @param props.players
 * @param props.shitheadPlayers
 * @param props.onLeaveRoom
 * @returns 등수 패널 엘리먼트
 */
export const ShitheadFinishedPanel = ({
  players,
  shitheadPlayers,
  onLeaveRoom,
}: ShitheadFinishedPanelProps): JSX.Element => {
  const ranked = [...shitheadPlayers].sort(
    (a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99),
  );
  const isLast = ranked.length > 0 ? ranked[ranked.length - 1] : null;

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
      <h2 className="text-xl font-bold">게임 종료!</h2>
      <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
        {ranked.map((sp) => {
          const nickname = players.find((p) => p.userId === sp.userId)?.nickname ?? "-";
          const isShithead = isLast?.userId === sp.userId;
          return (
            <li key={sp.userId}>
              <span className="mr-1">
                {sp.finishRank === 1 ? "🏆" : isShithead ? "💩" : `${sp.finishRank}등`}
              </span>
              {nickname}
              {isShithead && (
                <span className="ml-1 text-sm text-slate-400">(싯헤드)</span>
              )}
            </li>
          );
        })}
      </ol>
      <button
        onClick={onLeaveRoom}
        className="mt-4 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium transition hover:bg-indigo-500"
      >
        로비로 돌아가기
      </button>
    </div>
  );
};
