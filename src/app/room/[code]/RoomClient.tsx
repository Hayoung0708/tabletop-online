"use client";

import { useEffect, useRef, type JSX } from "react";
import { disconnectSocket } from "@/lib/socket";
import { SiteHeader } from "@/components/SiteHeader";
import { Toast } from "@/components/feedback/Toast";
import { AdRail } from "@/components/room/AdRail";
import { RoomHeader } from "@/components/room/RoomHeader";
import { NicknameForm } from "@/components/room/NicknameForm";
import { PlayerSidebar } from "@/components/room/PlayerSidebar";
import { DiceTray } from "@/components/room/DiceTray";
import { Scoreboard } from "@/components/room/Scoreboard";
import { WaitingPanel } from "@/components/room/WaitingPanel";
import { FinishedPanel } from "@/components/room/FinishedPanel";
import { EmoteOverlay } from "@/components/room/EmoteOverlay";
import { LeaveConfirmDialog } from "@/components/room/LeaveConfirmDialog";
import { useNicknameJoin } from "@/hooks/useNicknameJoin";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useRoomActions } from "@/hooks/useRoomActions";
import { useDiceRollAnimation } from "@/hooks/useDiceRollAnimation";
import { useYahtzeeCelebrations } from "@/hooks/useYahtzeeCelebrations";
import { useCopyRoomCode } from "@/hooks/useCopyRoomCode";

export interface RoomClientProps {
  code: string;
  roomName: string;
  userId: string;
}

/**
 * 방 화면 전체를 조립한다. 상태/소켓/애니메이션은 각 훅에 맡기고, 여기서는
 * 참가 단계(닉네임 폼 → 로딩 → 실제 게임 화면)에 따라 화면만 배치한다.
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
  const { rollDice, toggleHold, scoreCategory, startGame, sendEmote, leaveRoom } =
    useRoomActions(code);
  const { celebrations, addCelebration, removeCelebration } = useYahtzeeCelebrations();
  const { rollingMask, randomFaces, isRolling } = useDiceRollAnimation(
    state,
    addCelebration,
  );
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
  const isMyTurn = state?.currentPlayerId === userId;
  const hasRolled = (state?.rollsLeft ?? 3) < 3;
  const activePlayers = state?.players.filter((p) => p.connected) ?? [];
  const showBoard = state?.status === "PLAYING" || state?.status === "FINISHED";

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
      <EmoteOverlay
        activeEmotes={activeEmotes}
        onRemoveEmote={removeEmote}
        celebrations={celebrations}
        onRemoveCelebration={removeCelebration}
      />

      <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
        {joined && state && (
          <PlayerSidebar
            players={state.players}
            currentPlayerId={state.currentPlayerId}
            hostId={state.hostId}
            showTotals={state.status !== "WAITING"}
            onSendEmote={sendEmote}
          />
        )}

        <main className="flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6">
          <RoomHeader roomName={roomName} code={code} onCopyCode={copyCode} />

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
                  winnerUserId={state.winnerUserId}
                  onStartGame={startGame}
                />
              )}

              {state.status === "PLAYING" && (
                <DiceTray
                  dice={state.dice}
                  held={state.held}
                  rollingMask={rollingMask}
                  randomFaces={randomFaces}
                  rollsLeft={state.rollsLeft}
                  isMyTurn={isMyTurn}
                  hasRolled={hasRolled}
                  isRolling={isRolling}
                  onToggleHold={toggleHold}
                  onRoll={rollDice}
                />
              )}

              {state.status === "FINISHED" && (
                <FinishedPanel players={state.players} onLeaveRoom={leaveRoom} />
              )}

              {showBoard && (
                <Scoreboard
                  players={activePlayers}
                  dice={state.dice}
                  userId={userId}
                  isMyTurn={isMyTurn}
                  hasRolled={hasRolled && !isRolling}
                  onScore={scoreCategory}
                />
              )}

              {me === null && (
                <p className="text-sm text-slate-500">
                  이 방의 참가자가 아닙니다. 로비에서 참가해주세요.
                </p>
              )}
            </>
          )}
        </main>

        {joined && state && (
          <aside className="hidden w-52 shrink-0 border-l border-slate-800 px-4 py-4 sm:block" />
        )}
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
