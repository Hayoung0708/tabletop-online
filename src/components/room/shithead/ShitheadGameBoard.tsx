"use client";

import type { JSX } from "react";
import { OpponentRow } from "@/components/room/shithead/OpponentRow";
import { PileAndDeck } from "@/components/room/shithead/PileAndDeck";
import { MyZones } from "@/components/room/shithead/MyZones";
import { FaceUpSelection } from "@/components/room/shithead/FaceUpSelection";
import { ShitheadFinishedPanel } from "@/components/room/shithead/ShitheadFinishedPanel";
import { useShitheadActions } from "@/hooks/shithead/useShitheadActions";
import type { PublicRoomState } from "@/server/roomManager";

export interface ShitheadGameBoardProps {
  state: PublicRoomState;
  userId: string;
  onLeaveRoom: () => void;
}

/**
 * 싯헤드 게임판: 상대방 카드 상태, 가운데 더미/덱, 내 카드 영역을 조립한다.
 * 딜 직후에는 전원이 바닥패 3장을 고를 때까지 선택 화면을 먼저 보여준다.
 * @param props - 방 상태, 내 게스트 id, 나가기 핸들러
 * @param props.state
 * @param props.userId
 * @param props.onLeaveRoom
 * @returns 싯헤드 게임판 엘리먼트, 싯헤드 방이 아니면 null
 */
export const ShitheadGameBoard = ({
  state,
  userId,
  onLeaveRoom,
}: ShitheadGameBoardProps): JSX.Element | null => {
  const { selectFaceUp, playCards, playFaceDownCard, pickUpPile } = useShitheadActions();

  if (state.game.type !== "SHITHEAD") return null;
  const { game } = state;
  const me = game.players.find((p) => p.userId === userId);
  if (!me) return null;

  const isMyTurn = game.currentPlayerId === userId;
  const allSelected = game.players.every((p) => p.selectionDone);
  /**
   * 게스트 id로 닉네임을 찾는다.
   * @param id - 찾을 게스트 id
   */
  const nicknameOf = (id: string): string =>
    state.players.find((p) => p.userId === id)?.nickname ?? "-";

  return (
    <>
      {state.status === "PLAYING" && (
        <>
          <div className="flex flex-col gap-2">
            {game.players
              .filter((p) => p.userId !== userId)
              .map((p) => (
                <OpponentRow
                  key={p.userId}
                  nickname={nicknameOf(p.userId)}
                  player={p}
                  isCurrentTurn={game.currentPlayerId === p.userId}
                  showSelectionStatus={!allSelected}
                />
              ))}
          </div>

          <PileAndDeck pile={game.pile} deckCount={game.deckCount} />

          {!me.selectionDone ? (
            <FaceUpSelection hand={me.hand ?? []} onConfirm={selectFaceUp} />
          ) : (
            <MyZones
              hand={me.hand ?? []}
              faceUp={me.faceUp}
              faceDownCount={me.faceDownCount}
              pile={game.pile}
              isMyTurn={isMyTurn}
              onPlayCards={playCards}
              onPlayFaceDown={playFaceDownCard}
              onPickUpPile={pickUpPile}
            />
          )}
        </>
      )}

      {state.status === "FINISHED" && (
        <ShitheadFinishedPanel
          players={state.players}
          shitheadPlayers={game.players}
          onLeaveRoom={onLeaveRoom}
        />
      )}
    </>
  );
};
