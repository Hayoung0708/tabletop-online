"use client";

import type { JSX } from "react";
import type { PublicOneCardPlayer } from "@/server/onecard/gameLogic";
import type { PublicRoomState } from "@/server/roomManager";

export interface OneCardFinishedPanelProps {
  players: PublicRoomState["players"];
  oneCardPlayers: PublicOneCardPlayer[];
}

/** 순위별 메달 이모지 — 1/2/3등만 금/은/동, 그 아래는 "n등" 텍스트. */
const MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * 원카드 종료 후 등수표. 1등부터 순서대로 보여주고, 파산으로 탈락한
 * 사람은 표시를 함께 붙인다.
 * @param props - 참가자 정보
 * @param props.players
 * @param props.oneCardPlayers
 * @returns 등수 패널 엘리먼트
 */
export const OneCardFinishedPanel = ({
  players,
  oneCardPlayers,
}: OneCardFinishedPanelProps): JSX.Element => {
  const ranked = [...oneCardPlayers].sort(
    (a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99),
  );

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
      <h2 className="text-xl font-bold">게임 종료!</h2>
      <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
        {ranked.map((op) => {
          const nickname = players.find((p) => p.userId === op.userId)?.nickname ?? "-";
          const medal = op.finishRank ? MEDAL_BY_RANK[op.finishRank] : undefined;
          return (
            <li key={op.userId}>
              <span className="mr-1">{medal ?? `${op.finishRank}등`}</span>
              {nickname}
              {op.bankrupt && <span className="ml-1 text-sm text-red-400">(파산)</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
