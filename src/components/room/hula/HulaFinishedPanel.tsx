"use client";

import type { JSX } from "react";
import type { PublicHulaPlayer } from "@/server/hula/gameLogic";
import type { PublicRoomState } from "@/server/roomManager";

export interface HulaFinishedPanelProps {
  players: PublicRoomState["players"];
  hulaPlayers: PublicHulaPlayer[];
}

/** 순위별 메달 이모지 — 1/2/3등만 금/은/동, 그 아래는 "n등" 텍스트. */
const MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * 훌라 종료 후 등수표. 손패에 남은 카드가 적은 사람부터 앞 등수를 받는다
 * (점수는 등수를 매기는 데만 쓰고 화면에는 보여주지 않는다 — 다른 게임과
 * 마찬가지로 등수·승수로만 이야기한다).
 * @param props - 참가자 정보
 * @param props.players
 * @param props.hulaPlayers
 * @returns 등수 패널 엘리먼트
 */
export const HulaFinishedPanel = ({
  players,
  hulaPlayers,
}: HulaFinishedPanelProps): JSX.Element => {
  const ranked = [...hulaPlayers].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
      <h2 className="text-xl font-bold">게임 종료!</h2>
      <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
        {ranked.map((hp, index) => {
          const nickname = players.find((p) => p.userId === hp.userId)?.nickname ?? "-";
          return (
            <li key={hp.userId}>
              <span className="mr-1">{MEDAL_BY_RANK[index + 1] ?? `${index + 1}등`}</span>
              {nickname}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
