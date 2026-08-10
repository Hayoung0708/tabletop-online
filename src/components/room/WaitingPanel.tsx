"use client";

import { useState, type JSX } from "react";
import { GAMES } from "@/constants/games";
import { ROOM_NAME_MAX_LENGTH } from "@/constants/app";
import { SHITHEAD_MAX_PLAYERS } from "@/constants/shithead";
import type { PublicRoomState } from "@/server/roomManager";

const MIN_PLAYERS_TO_START = 2;

export interface WaitingPanelProps {
  players: PublicRoomState["players"];
  activePlayerCount: number;
  maxPlayers: number;
  isHost: boolean;
  roomName: string;
  gameType: string;
  winnerUserId: string | null;
  onStartGame: () => void;
  onUpdateRoom: (name: string, gameType: string) => void;
}

/**
 * 게임 시작 전 대기 화면. 방장은 시작 버튼 왼쪽의 변경 버튼으로 방 제목과 게임
 * 종류를 바꿀 수 있다. 직전 게임 승자가 있으면 안내 배너도 함께 보여준다.
 * @param props - 참가자 현황과 방 정보, 시작/변경 핸들러
 * @param props.players
 * @param props.activePlayerCount
 * @param props.maxPlayers
 * @param props.isHost
 * @param props.roomName
 * @param props.gameType
 * @param props.winnerUserId
 * @param props.onStartGame
 * @param props.onUpdateRoom
 * @returns 대기 패널 엘리먼트
 */
export const WaitingPanel = ({
  players,
  activePlayerCount,
  maxPlayers,
  isHost,
  roomName,
  gameType,
  winnerUserId,
  onStartGame,
  onUpdateRoom,
}: WaitingPanelProps): JSX.Element => {
  const winnerNickname = players.find((p) => p.userId === winnerUserId)?.nickname ?? "-";
  // 싯헤드는 52장 덱 한계로 5명까지만 시작할 수 있다(방 정원 6명과는 별개).
  const tooManyForGame =
    gameType === "SHITHEAD" && activePlayerCount > SHITHEAD_MAX_PLAYERS;
  const canStart = activePlayerCount >= MIN_PLAYERS_TO_START && !tooManyForGame;

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(roomName);
  const [gameDraft, setGameDraft] = useState(gameType);

  /** 변경 폼을 현재 값으로 초기화해서 연다. */
  const openEdit = (): void => {
    setNameDraft(roomName);
    setGameDraft(gameType);
    setEditing(true);
  };

  /** 변경 내용을 서버에 보내고 폼을 닫는다. */
  const saveEdit = (): void => {
    onUpdateRoom(nameDraft, gameDraft);
    setEditing(false);
  };

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
      {tooManyForGame && (
        <p className="mt-2 text-sm text-amber-400">
          싯헤드는 최대 {SHITHEAD_MAX_PLAYERS}명까지 플레이할 수 있습니다
        </p>
      )}

      {isHost && editing ? (
        <div className="mx-auto mt-5 flex max-w-sm flex-col gap-3 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">방 제목</span>
            <input
              value={nameDraft}
              onChange={(e): void => setNameDraft(e.target.value)}
              maxLength={ROOM_NAME_MAX_LENGTH}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus:border-indigo-500"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">게임</span>
            <div className="grid grid-cols-2 gap-2">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  disabled={game.disabled}
                  onClick={(): void => setGameDraft(game.id)}
                  aria-pressed={gameDraft === game.id}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-4 transition ${
                    game.disabled
                      ? "cursor-default border-slate-800 bg-slate-800/40 text-slate-500"
                      : gameDraft === game.id
                        ? "border-indigo-500 bg-indigo-950"
                        : "border-slate-700 bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={game.icon}
                    alt=""
                    className={`h-10 w-10 ${game.disabled ? "opacity-40" : ""}`}
                  />
                  <span className="text-base font-semibold">{game.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={(): void => setEditing(false)}
              className="rounded-lg border border-slate-700 px-5 py-2 text-base font-medium transition hover:bg-slate-800"
            >
              취소
            </button>
            <button
              onClick={saveEdit}
              disabled={nameDraft.trim().length === 0}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-base font-medium transition hover:bg-indigo-500 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      ) : isHost ? (
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={openEdit}
            className="rounded-lg border border-slate-700 px-7 py-3 font-medium transition hover:bg-slate-800"
          >
            설정
          </button>
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className="rounded-lg bg-indigo-600 px-7 py-3 font-medium transition hover:bg-indigo-500 disabled:opacity-50"
          >
            게임 시작
          </button>
        </div>
      ) : (
        <p className="mt-5 text-lg text-slate-500">
          방장이 게임을 시작하기를 기다리는 중...
        </p>
      )}
    </div>
  );
};
