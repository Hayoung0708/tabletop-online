"use client";

import type { JSX } from "react";
import { DiceTray } from "@/components/room/yatzy/DiceTray";
import { Scoreboard } from "@/components/room/yatzy/Scoreboard";
import { FinishedPanel } from "@/components/room/yatzy/FinishedPanel";
import { YahtzeeCelebration } from "@/components/room/yatzy/YahtzeeCelebration";
import { useYatzyActions } from "@/hooks/yatzy/useYatzyActions";
import { useDiceRollAnimation } from "@/hooks/yatzy/useDiceRollAnimation";
import { useYahtzeeCelebrations } from "@/hooks/yatzy/useYahtzeeCelebrations";
import type { PublicRoomState } from "@/server/roomManager";

export interface YatzyGameBoardProps {
  state: PublicRoomState;
  userId: string;
}

/**
 * 야찌 게임판: 주사위/점수표/종료 화면을 조립한다.
 * @param props - 방 상태, 내 게스트 id, 나가기 핸들러
 * @param props.state
 * @param props.userId
 * @returns 야찌 게임판 엘리먼트, 야찌 방이 아니면 null
 */
export const YatzyGameBoard = ({
  state,
  userId,
}: YatzyGameBoardProps): JSX.Element | null => {
  const game = state.game.type === "YATZY" ? state.game : null;
  const { rollDice, toggleHold, scoreCategory, isRollPending } = useYatzyActions(
    game?.rollsLeft ?? 0,
  );
  const { celebrations, addCelebration, removeCelebration } = useYahtzeeCelebrations();
  const { rollingMask, randomFaces, isRolling } = useDiceRollAnimation(
    game,
    addCelebration,
  );

  if (!game) return null;

  const activePlayers = state.players.filter((p) => p.connected);
  const isMyTurn = game.currentPlayerId === userId;
  const hasRolled = game.rollsLeft < 3;

  return (
    <>
      {state.status === "PLAYING" && (
        <DiceTray
          dice={game.dice}
          held={game.held}
          rollingMask={rollingMask}
          randomFaces={randomFaces}
          rollsLeft={game.rollsLeft}
          isMyTurn={isMyTurn}
          hasRolled={hasRolled}
          isRolling={isRolling}
          isRollPending={isRollPending}
          onToggleHold={toggleHold}
          onRoll={rollDice}
        />
      )}

      {state.status === "FINISHED" && (
        <FinishedPanel players={state.players} totals={game.totals} />
      )}

      <Scoreboard
        players={activePlayers}
        scorecards={game.scorecards}
        totals={game.totals}
        dice={game.dice}
        userId={userId}
        isMyTurn={isMyTurn}
        hasRolled={hasRolled && !isRolling}
        onScore={scoreCategory}
      />

      <div className="pointer-events-none fixed inset-0 z-40">
        {celebrations.map((c) => (
          <YahtzeeCelebration key={c.id} onDone={() => removeCelebration(c.id)} />
        ))}
      </div>
    </>
  );
};
