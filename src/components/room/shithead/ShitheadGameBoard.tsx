"use client";

import type { JSX } from "react";
import { OpponentRow } from "@/components/room/shithead/OpponentRow";
import { PileAndDeck } from "@/components/room/shithead/PileAndDeck";
import { MyZones } from "@/components/room/shithead/MyZones";
import { FaceUpSelection } from "@/components/room/shithead/FaceUpSelection";
import { ShitheadFinishedPanel } from "@/components/room/shithead/ShitheadFinishedPanel";
import { StarterAnnounceToast } from "@/components/room/shithead/StarterAnnounceToast";
import { useShitheadActions } from "@/hooks/shithead/useShitheadActions";
import { useStarterAnnounce } from "@/hooks/shithead/useStarterAnnounce";
import type { PublicRoomState } from "@/server/roomManager";

export interface ShitheadGameBoardProps {
  state: PublicRoomState;
  userId: string;
}

/**
 * 싯헤드 게임판: 상대방 카드 상태, 가운데 더미/덱, 내 카드 영역을 조립한다.
 * 딜 직후에는 전원이 바닥패 3장을 고를 때까지 선택 화면을 먼저 보여준다.
 * 게임이 끝나면(FINISHED) 등수표만 보여준다 — 재시작은 room 페이지의
 * 대기 카드(설정/시작)가 맡는다.
 * @param props - 방 상태, 내 게스트 id
 * @param props.state
 * @param props.userId
 * @returns 싯헤드 게임판 엘리먼트, 싯헤드 방이 아니면 null
 */
export const ShitheadGameBoard = ({
  state,
  userId,
}: ShitheadGameBoardProps): JSX.Element | null => {
  const { selectFaceUp, playCards, playFaceDownCard, pickUpPile } = useShitheadActions();

  const game = state.game.type === "SHITHEAD" ? state.game : null;
  const allSelected = game ? game.players.every((p) => p.selectionDone) : false;
  /**
   * 게스트 id로 닉네임을 찾는다.
   * @param id - 찾을 게스트 id
   * @returns 닉네임, 없으면 "-"
   */
  const nicknameOf = (id: string): string =>
    state.players.find((p) => p.userId === id)?.nickname ?? "-";
  const starterAnnounce = useStarterAnnounce(
    allSelected,
    nicknameOf(game?.currentPlayerId ?? ""),
  );

  if (!game) return null;
  const me = game.players.find((p) => p.userId === userId);
  if (!me) return null;

  const isMyTurn = game.currentPlayerId === userId;

  return (
    <>
      <StarterAnnounceToast announce={starterAnnounce} />

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
            <FaceUpSelection
              userId={userId}
              hand={me.hand ?? []}
              onConfirm={selectFaceUp}
            />
          ) : (
            <MyZones
              userId={userId}
              hand={me.hand ?? []}
              faceUp={me.faceUp}
              faceDown={me.faceDown}
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
        <ShitheadFinishedPanel players={state.players} shitheadPlayers={game.players} />
      )}
    </>
  );
};
