"use client";

import { useEffect, useRef, type JSX } from "react";
import { disconnectSocket } from "@/lib/socket";
import { SiteHeader } from "@/components/SiteHeader";
import { Toast } from "@/components/feedback/Toast";
import { AdRail } from "@/components/room/AdRail";
import { RoomHeader } from "@/components/room/RoomHeader";
import { NicknameForm } from "@/components/room/NicknameForm";
import { PlayerSidebar } from "@/components/room/PlayerSidebar";
import { WaitingPanel } from "@/components/room/WaitingPanel";
import { Rulebook } from "@/components/room/Rulebook";
import { LeaveConfirmDialog } from "@/components/room/LeaveConfirmDialog";
import { YatzyGameBoard } from "@/components/room/yatzy/YatzyGameBoard";
import { ShitheadGameBoard } from "@/components/room/shithead/ShitheadGameBoard";
import { useNicknameJoin } from "@/hooks/useNicknameJoin";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useRoomActions } from "@/hooks/useRoomActions";
import { useCopyRoomCode } from "@/hooks/useCopyRoomCode";
import type { PublicRoomState } from "@/server/roomManager";

export interface RoomClientProps {
  code: string;
  roomName: string;
  userId: string;
}

/**
 * 참가자 목록 옆에 보여줄 한 줄짜리 추가 정보를 게임 종류에 맞게 만든다
 * (야찌는 총점, 싯헤드는 남은 카드 수). 대기 중에는 아무것도 안 보여준다.
 * @param state - 현재 방 상태
 * @returns 유저id를 받아 추가 정보 문자열을 돌려주는 함수, 보여줄 게 없으면 undefined
 */
const buildSidebarExtraLine = (
  state: PublicRoomState | null,
): ((userId: string) => string | null) | undefined => {
  if (!state || state.status === "WAITING") return undefined;

  if (state.game.type === "YATZY") {
    const { totals } = state.game;
    return (userId) => `${totals[userId]}점`;
  }

  const { players } = state.game;
  return (userId) => {
    const p = players.find((pl) => pl.userId === userId);
    if (!p) return null;
    return `카드 ${p.handCount + p.faceUp.length + p.faceDownCount}장`;
  };
};

/**
 * 방 화면 전체를 조립한다. 상태/소켓은 훅에 맡기고, 여기서는 참가
 * 단계(닉네임 폼 → 로딩 → 대기 화면 → 게임판)에 따라 화면만 배치한다.
 * 실제 게임판은 게임 종류에 맞는 GameBoard 컴포넌트에 위임한다.
 * @param props - 방 코드, 방 이름, 내 게스트 식별자
 * @param props.code
 * @param props.roomName
 * @param props.userId
 * @returns 방 화면 엘리먼트
 */
export const RoomClient = ({ code, roomName, userId }: RoomClientProps): JSX.Element => {
  const leaveDialogRef = useRef<HTMLDialogElement>(null);

  const { nickname, setNickname, joined, joining, joinError, joinRoom } =
    useNicknameJoin(code);
  const { state, error, toast, activeEmotes, removeEmote } = useRoomSocket(
    code,
    joined,
    userId,
  );
  const { startGame, updateRoom, sendEmote, emoteOnCooldown, leaveRoom } =
    useRoomActions(code);
  const { copied, copyCode } = useCopyRoomCode(code);

  // 소켓은 페이지 이동에도 살아남는 싱글턴이라, 이 방을 벗어날 때(버튼,
  // 뒤로가기, 헤더 로고) 직접 끊어야 서버가 이탈을 감지한다.
  useEffect(() => {
    return (): void => {
      disconnectSocket();
    };
  }, []);

  const me = state?.players.find((p) => p.userId === userId) ?? null;
  const isHost = state?.hostId === userId;
  const activePlayers = state?.players.filter((p) => p.connected) ?? [];

  /** 진행 중인 게임이면 확인 다이얼로그를 띄우고, 아니면 바로 나간다. */
  const handleExit = (): void => {
    if (state?.status === "PLAYING") {
      leaveDialogRef.current?.showModal();
      return;
    }
    leaveRoom();
  };

  return (
    <>
      <SiteHeader onExit={handleExit} />
      <AdRail side="left" />
      <AdRail side="right" />

      <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
        {joined && state && (
          <PlayerSidebar
            players={state.players}
            currentPlayerId={state.game.currentPlayerId}
            hostId={state.hostId}
            extraLine={buildSidebarExtraLine(state)}
            onSendEmote={sendEmote}
            emoteOnCooldown={emoteOnCooldown}
            activeEmotes={activeEmotes}
            onRemoveEmote={removeEmote}
          />
        )}

        <main className="flex w-full max-w-4xl min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6">
          <RoomHeader
            roomName={state?.name ?? roomName}
            code={code}
            gameType={state?.game.type ?? null}
            onCopyCode={copyCode}
          />

          {!joined ? (
            <NicknameForm
              nickname={nickname}
              onNicknameChange={setNickname}
              onSubmit={joinRoom}
              joining={joining}
              joinError={joinError}
            />
          ) : !state ? (
            <p className="text-slate-400">방에 연결하는 중...</p>
          ) : (
            <>
              {error && (
                <p className="rounded-md bg-red-950 px-4 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              {state.status === "WAITING" && (
                <WaitingPanel
                  players={state.players}
                  activePlayerCount={activePlayers.length}
                  maxPlayers={state.maxPlayers}
                  isHost={isHost}
                  roomName={state.name}
                  gameType={state.game.type}
                  winnerUserId={state.game.winnerUserId}
                  onStartGame={startGame}
                  onUpdateRoom={updateRoom}
                />
              )}

              {(state.status === "PLAYING" || state.status === "FINISHED") &&
                (state.game.type === "YATZY" ? (
                  <YatzyGameBoard state={state} userId={userId} onLeaveRoom={leaveRoom} />
                ) : (
                  <ShitheadGameBoard
                    state={state}
                    userId={userId}
                    onLeaveRoom={leaveRoom}
                  />
                ))}

              {me === null && (
                <p className="text-sm text-slate-500">
                  이 방의 참가자가 아닙니다. 로비에서 참가해주세요.
                </p>
              )}
            </>
          )}
        </main>

        {joined && state && <Rulebook gameType={state.game.type} />}
      </div>

      {copied && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg"
        >
          복사되었습니다!
        </div>
      )}
      <Toast toast={toast} />

      <LeaveConfirmDialog
        dialogRef={leaveDialogRef}
        onCancel={() => leaveDialogRef.current?.close()}
        onLeave={leaveRoom}
      />
    </>
  );
};
