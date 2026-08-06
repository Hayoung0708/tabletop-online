"use client";

import type { JSX } from "react";
import type { PublicRoomState } from "@/server/roomManager";

const MIN_PLAYERS_TO_START = 2;

export interface WaitingPanelProps {
  players: PublicRoomState["players"];
  activePlayerCount: number;
  maxPlayers: number;
  isHost: boolean;
  winnerUserId: string | null;
  onStartGame: () => void;
}

/**
 * 게임 시작 전 대기 화면. 직전 게임 승자가 있으면 안내 배너도 함께 보여준다.
 * @param props - 참가자 현황과 시작 핸들러
 * @param props.players
 * @param props.activePlayerCount
 * @param props.maxPlayers
 * @param props.isHost
 * @param props.winnerUserId
 * @param props.onStartGame
 * @returns 대기 패널 엘리먼트
 */
export const WaitingPanel = ({
  players,
  activePlayerCount,
  maxPlayers,
  isHost,
  winnerUserId,
  onStartGame,
}: WaitingPanelProps): JSX.Element => {
  const winnerNickname = players.find((p) => p.userId === winnerUserId)?.nickname ?? "-";
  const canStart = activePlayerCount >= MIN_PLAYERS_TO_START;

  return (
    <div className="rounded-xl border border-slate-800 p-6 text-center">
      {winnerUserId && (
        <p className="mb-4 rounded-lg bg-indigo-950 px-4 py-2.5 text-sm text-indigo-200">
          🏆 {winnerNickname}님 승리! 상대방이 나가서 게임이 종료되었습니다.
        </p>
      )}
      <p className="text-base text-slate-400">
        플레이어를 기다리는 중입니다 ({activePlayerCount}/{maxPlayers})
      </p>
      {isHost ? (
        <button
          onClick={onStartGame}
          disabled={!canStart}
          className="mt-5 rounded-lg bg-indigo-600 px-7 py-3 font-medium transition hover:bg-indigo-500 disabled:opacity-50"
        >
          게임 시작 {!canStart && "(최소 2명)"}
        </button>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          방장이 게임을 시작하기를 기다리는 중...
        </p>
      )}
    </div>
  );
};
