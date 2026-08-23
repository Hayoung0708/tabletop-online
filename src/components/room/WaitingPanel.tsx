"use client";

import { useState, type JSX } from "react";
import { GAMES } from "@/constants/games";
import { ROOM_NAME_MAX_LENGTH } from "@/constants/app";
import {
  SHITHEAD_MAX_PLAYERS,
  SHITHEAD_MAX_PLAYERS_WITH_JOKERS,
} from "@/constants/shithead";
import type { PublicRoomState } from "@/server/roomManager";

const MIN_PLAYERS_TO_START = 2;

export interface WaitingPanelProps {
  players: PublicRoomState["players"];
  activePlayerCount: number;
  maxPlayers: number;
  isHost: boolean;
  roomName: string;
  gameType: string;
  /** 싯헤드 조커(54장) 모드가 켜져 있는지. */
  useJokers: boolean;
  /**
   * 다른 사람들이 다 나가서 혼자 남아 이긴 사람. 정상적으로 끝난 판에서는
   * null이라 "나가서 종료" 안내가 뜨지 않는다.
   */
  abandonedWinnerUserId: string | null;
  onStartGame: () => void;
  onUpdateRoom: (name: string, gameType: string, useJokers: boolean) => void;
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
 * @param props.useJokers
 * @param props.abandonedWinnerUserId
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
  useJokers,
  abandonedWinnerUserId,
  onStartGame,
  onUpdateRoom,
}: WaitingPanelProps): JSX.Element => {
  const winnerNickname =
    players.find((p) => p.userId === abandonedWinnerUserId)?.nickname ?? "-";
  // 싯헤드는 덱 한계로 인원이 막힌다 — 52장이면 5명, 조커를 넣은 54장이면 6명.
  const shitheadLimit = useJokers
    ? SHITHEAD_MAX_PLAYERS_WITH_JOKERS
    : SHITHEAD_MAX_PLAYERS;
  const tooManyForGame = gameType === "SHITHEAD" && activePlayerCount > shitheadLimit;
  const canStart = activePlayerCount >= MIN_PLAYERS_TO_START && !tooManyForGame;

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(roomName);
  const [gameDraft, setGameDraft] = useState(gameType);
  const [jokerDraft, setJokerDraft] = useState(useJokers);

  /** 변경 폼을 현재 값으로 초기화해서 연다. */
  const openEdit = (): void => {
    setNameDraft(roomName);
    setGameDraft(gameType);
    setJokerDraft(useJokers);
    setEditing(true);
  };

  /** 변경 내용을 서버에 보내고 폼을 닫는다. */
  const saveEdit = (): void => {
    onUpdateRoom(nameDraft, gameDraft, jokerDraft);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-slate-800 p-6 text-center">
      {abandonedWinnerUserId && (
        <p className="mb-4 rounded-lg bg-indigo-950 px-4 py-2.5 text-sm text-indigo-200">
          🏆 {winnerNickname}님 승리! 상대방이 나가서 게임이 종료되었습니다.
        </p>
      )}
      <p className="text-base text-slate-400">
        플레이어를 기다리는 중입니다 ({activePlayerCount}/{maxPlayers})
      </p>
      {tooManyForGame && (
        <p className="mt-2 text-sm text-amber-400">
          싯헤드는 이 설정에서 최대 {shitheadLimit}명까지 플레이할 수 있습니다
          {!useJokers && " (조커 모드로 바꾸면 6명까지 가능)"}
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
          {gameDraft === "SHITHEAD" && (
            <label className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
              <input
                type="checkbox"
                checked={jokerDraft}
                onChange={(e): void => setJokerDraft(e.target.checked)}
                className="mt-1 h-4 w-4 accent-indigo-500"
              />
              <span className="flex flex-col">
                <span className="text-base">조커 포함 (54장)</span>
                <span className="text-sm text-slate-400">
                  6명이 하려면 켜야 합니다. 조커는 혼자 못 내고 같이 낸 카드의 숫자로
                  쓰입니다.
                </span>
              </span>
            </label>
          )}
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
