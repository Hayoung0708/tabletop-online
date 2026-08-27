"use client";

import type { JSX } from "react";
import { OpponentRow } from "@/components/room/shithead/OpponentRow";
import { PileAndDeck } from "@/components/room/shithead/PileAndDeck";
import { MyZones } from "@/components/room/shithead/MyZones";
import { FaceUpSelection } from "@/components/room/shithead/FaceUpSelection";
import { ShitheadFinishedPanel } from "@/components/room/shithead/ShitheadFinishedPanel";
import { CenterAnnounceToast } from "@/components/room/CenterAnnounceToast";
import { useShitheadActions } from "@/hooks/shithead/useShitheadActions";
import { useStarterAnnounce } from "@/hooks/shithead/useStarterAnnounce";
import { useCenterAnnounce } from "@/hooks/useCenterAnnounce";
import type { PublicRoomState } from "@/server/roomManager";

export interface ShitheadGameBoardProps {
  state: PublicRoomState;
  userId: string;
}

/**
 * 싯헤드 게임판: 상대방 카드 상태, 가운데 더미/덱, 내 카드 영역을 조립한다.
 * 딜 직후에는 전원이 얼굴패 3장을 고를 때까지 선택 화면을 먼저 보여준다.
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
  const { announce, showAnnounce } = useCenterAnnounce();
  useStarterAnnounce(allSelected, nicknameOf(game?.currentPlayerId ?? ""), showAnnounce);

  if (!game) return null;
  const me = game.players.find((p) => p.userId === userId);
  if (!me) return null;

  const isMyTurn = game.currentPlayerId === userId;

  // 상대는 턴 순서(나 다음 차례부터)대로 나열한다 — players 배열이 곧 턴
  // 순서이므로 내 위치 기준으로 회전시키면 된다.
  const myIndex = game.players.findIndex((p) => p.userId === userId);
  const opponents = [
    ...game.players.slice(myIndex + 1),
    ...game.players.slice(0, myIndex),
  ];
  // 최대 두 줄로 배치해 메인 영역에 세로 스크롤이 생기지 않게 한다.
  // 1~2명: 한 줄에 한 명씩 / 3명: 첫 줄 1명 + 둘째 줄 2명 / 4명: 2명 + 2명.
  const firstRowCount = opponents.length <= 2 ? 1 : Math.floor(opponents.length / 2);
  const opponentRows = [
    opponents.slice(0, firstRowCount),
    opponents.slice(firstRowCount),
  ].filter((row) => row.length > 0);

  return (
    <>
      <CenterAnnounceToast announce={announce} />

      {state.status === "PLAYING" && (
        <>
          <div className="flex flex-col gap-2">
            {opponentRows.map((row) => (
              <div key={row[0].userId} className="flex flex-col gap-2 sm:flex-row">
                {row.map((p) => (
                  <div key={p.userId} className="min-w-0 flex-1">
                    <OpponentRow
                      nickname={nicknameOf(p.userId)}
                      player={p}
                      isCurrentTurn={game.currentPlayerId === p.userId}
                      showSelectionStatus={!allSelected}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <PileAndDeck
            pile={game.pile}
            deckCount={game.deckCount}
            lastPlayedCount={game.lastPlayedCount}
          />

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
