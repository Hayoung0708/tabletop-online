"use client";

import type { JSX } from "react";
import type { PublicShitheadPlayer } from "@/server/shithead/gameLogic";
import type { PublicRoomState } from "@/server/roomManager";

export interface ShitheadFinishedPanelProps {
  players: PublicRoomState["players"];
  shitheadPlayers: PublicShitheadPlayer[];
}

/** 순위별 메달 이모지 — 1/2/3등만 금/은/동, 그 아래는 "n등" 텍스트. */
const MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * 게임 종료 후 등수표. 1등부터 마지막까지 순서대로 보여준다. 1~3등은
 * 금/은/동 메달로, 나머지는 "n등"으로 표시한다.
 * @param props - 참가자 정보
 * @param props.players
 * @param props.shitheadPlayers
 * @returns 등수 패널 엘리먼트
 */
export const ShitheadFinishedPanel = ({
  players,
  shitheadPlayers,
}: ShitheadFinishedPanelProps): JSX.Element => {
  const ranked = [...shitheadPlayers].sort(
    (a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99),
  );

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
      <h2 className="text-xl font-bold">게임 종료!</h2>
      <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
        {ranked.map((sp) => {
          const nickname = players.find((p) => p.userId === sp.userId)?.nickname ?? "-";
          const medal = sp.finishRank ? MEDAL_BY_RANK[sp.finishRank] : undefined;
          return (
            <li key={sp.userId}>
              <span className="mr-1">{medal ?? `${sp.finishRank}등`}</span>
              {nickname}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
