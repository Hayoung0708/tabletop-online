"use client";

import type { JSX } from "react";
import type { PublicRoomState } from "@/server/roomManager";

export interface FinishedPanelProps {
  players: PublicRoomState["players"];
  totals: Record<string, number>;
  onLeaveRoom: () => void;
}

/**
 * 게임 종료 후 순위표.
 * @param props - 참가자 점수와 로비 이동 핸들러
 * @param props.players
 * @param props.totals
 * @param props.onLeaveRoom
 * @returns 결과 패널 엘리먼트
 */
export const FinishedPanel = ({
  players,
  totals,
  onLeaveRoom,
}: FinishedPanelProps): JSX.Element => {
  const ranked = [...players].sort((a, b) => totals[b.userId] - totals[a.userId]);

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
      <h2 className="text-xl font-bold">게임 종료!</h2>
      <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
        {ranked.map((p, i) => (
          <li key={p.userId}>
            <span className="mr-1">{i === 0 ? "🏆" : `${i + 1}위`}</span>
            {p.nickname} — <b>{totals[p.userId]}점</b>
          </li>
        ))}
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
