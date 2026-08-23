"use client";

import type { JSX } from "react";
import type { PublicHulaPlayer } from "@/server/hula/gameLogic";
import type { PublicRoomState } from "@/server/roomManager";

export interface HulaFinishedPanelProps {
  players: PublicRoomState["players"];
  hulaPlayers: PublicHulaPlayer[];
  /** 스톱으로 끝난 판이면 스톱을 부른 사람. */
  stoppedByUserId: string | null;
}

/** 순위별 메달 이모지 — 1/2/3등만 금/은/동, 그 아래는 "n등" 텍스트. */
const MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * 훌라 종료 후 등수표. 서버가 확정한 등수 순으로 보여주고, 판단 근거가 되는
 * 손패 점수와 장수를 함께 적는다.
 * @param props - 참가자 정보
 * @param props.players
 * @param props.hulaPlayers
 * @param props.stoppedByUserId - 스톱을 부른 사람
 * @returns 등수 패널 엘리먼트
 */
export const HulaFinishedPanel = ({
  players,
  hulaPlayers,
  stoppedByUserId,
}: HulaFinishedPanelProps): JSX.Element => {
  const ranked = [...hulaPlayers].sort(
    (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const stopperNickname = players.find((p) => p.userId === stoppedByUserId)?.nickname;

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
      <h2 className="text-xl font-bold">게임 종료!</h2>
      {stopperNickname && (
        <p className="mt-1 text-sm text-amber-300">{stopperNickname}님의 스톱</p>
      )}
      <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
        {ranked.map((hulaPlayer) => {
          const nickname =
            players.find((p) => p.userId === hulaPlayer.userId)?.nickname ?? "-";
          const rank = hulaPlayer.rank ?? ranked.length;
          return (
            <li key={hulaPlayer.userId}>
              <span className="mr-1">{MEDAL_BY_RANK[rank] ?? `${rank}등`}</span>
              {nickname}
              <span className="ml-2 text-sm text-slate-400">
                {hulaPlayer.points ?? 0}점 · {hulaPlayer.handCount}장
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
