"use client";

import type { JSX } from "react";
import { InfoTooltip } from "@/components/icons/RoomIcons";
import {
  CATEGORY_LABELS,
  LOWER_CATEGORIES,
  SCORE_CELL_BASE_CLASS,
  UPPER_CATEGORIES,
} from "@/constants/scoreboard";
import { calculateScore, upperBonus, upperTotal, type Category } from "@/utils/yatzy";
import type { PublicRoomState } from "@/server/roomManager";

const BONUS_TOOLTIP_TEXT =
  "상단(1~6) 항목 점수의 합이 63점 이상이면 보너스로 35점을 추가로 획득합니다.\n각 숫자를 3개씩만 모아도 63점이 되어 보너스 조건을 채울 수 있어요.";

type PlayerRow = PublicRoomState["players"][number];

export interface ScoreboardProps {
  players: PlayerRow[];
  dice: number[];
  userId: string;
  isMyTurn: boolean;
  hasRolled: boolean;
  onScore: (category: Category) => void;
}

/**
 * 야찌 점수표 전체 (상단/보너스/하단/합계).
 * @param props - 참가자 점수 데이터와 항목 클릭 핸들러
 * @param props.players
 * @param props.dice
 * @param props.userId
 * @param props.isMyTurn
 * @param props.hasRolled
 * @param props.onScore
 * @returns 점수표 엘리먼트
 */
export const Scoreboard = ({
  players,
  dice,
  userId,
  isMyTurn,
  hasRolled,
  onScore,
}: ScoreboardProps): JSX.Element => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="bg-slate-900">
            <th className="rounded-tl-xl py-1.5 pr-2 pl-4 text-left text-base font-bold text-slate-200">
              항목
            </th>
            {players.map((p) => (
              <th
                key={p.userId}
                className="px-2 py-1.5 text-center text-base font-bold text-slate-200 last:rounded-tr-xl"
              >
                {p.nickname}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER_CATEGORIES.map((cat, idx) => (
            <ScoreRow
              key={cat}
              cat={cat}
              idx={idx}
              players={players}
              dice={dice}
              userId={userId}
              isMyTurn={isMyTurn}
              hasRolled={hasRolled}
              onScore={onScore}
            />
          ))}
          <BonusRow players={players} />
          {LOWER_CATEGORIES.map((cat, idx) => (
            <ScoreRow
              key={cat}
              cat={cat}
              idx={idx}
              players={players}
              dice={dice}
              userId={userId}
              isMyTurn={isMyTurn}
              hasRolled={hasRolled}
              onScore={onScore}
            />
          ))}
          <TotalRow players={players} />
        </tbody>
      </table>
    </div>
  );
};

interface ScoreRowProps {
  cat: Category;
  idx: number;
  players: PlayerRow[];
  dice: number[];
  userId: string;
  isMyTurn: boolean;
  hasRolled: boolean;
  onScore: (cat: Category) => void;
}

/**
 * 점수표 한 줄. 채울 수 있는 칸이면 버튼으로, 이미 채웠으면 값으로 보여준다.
 * @param props - 해당 항목의 표시/입력 데이터
 * @param props.cat
 * @param props.idx
 * @param props.players
 * @param props.dice
 * @param props.userId
 * @param props.isMyTurn
 * @param props.hasRolled
 * @param props.onScore
 * @returns 테이블 행 엘리먼트
 */
const ScoreRow = ({
  cat,
  idx,
  players,
  dice,
  userId,
  isMyTurn,
  hasRolled,
  onScore,
}: ScoreRowProps): JSX.Element => {
  return (
    <tr className={idx % 2 === 0 ? "bg-transparent" : "bg-slate-950/30"}>
      <td className="py-1 pr-2 pl-4 text-slate-300">{CATEGORY_LABELS[cat]}</td>
      {players.map((p) => {
        const filled = p.scorecard[cat];
        const isOwnTurn = p.userId === userId && isMyTurn && hasRolled;
        // 이미 채운 야찌 칸이라도 다시 5개가 같은 눈이면 위에 쌓을 수 있다.
        const stackable =
          cat === "yahtzee" &&
          filled !== null &&
          filled > 0 &&
          isOwnTurn &&
          dice.every((d) => d === dice[0]);
        const clickable = (isOwnTurn && filled === null) || stackable;
        const preview = clickable ? calculateScore(cat, dice) : null;

        return (
          <td key={p.userId} className="px-2 py-1 text-center">
            {clickable ? (
              <button
                onClick={() => onScore(cat)}
                className={`${SCORE_CELL_BASE_CLASS} border-dashed border-indigo-500/70 text-indigo-300 transition hover:bg-indigo-700 hover:text-white`}
              >
                {stackable ? (filled ?? 0) + (preview ?? 0) : preview}
              </button>
            ) : filled !== null ? (
              <span
                className={`${SCORE_CELL_BASE_CLASS} border-transparent bg-slate-800/80`}
              >
                {filled}
              </span>
            ) : (
              <span
                className={`${SCORE_CELL_BASE_CLASS} border-transparent text-slate-700`}
              >
                -
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
};

/**
 * 상단 보너스 조건 달성 여부를 보여주는 줄.
 * @param props - 참가자 목록
 * @param props.players
 * @returns 테이블 행 엘리먼트
 */
const BonusRow = ({ players }: { players: PlayerRow[] }): JSX.Element => {
  return (
    <tr className="bg-slate-950/60 text-base">
      <td className="py-1.5 pr-2 pl-4 text-slate-400">
        <span className="inline-flex items-center gap-1">
          보너스
          <InfoTooltip text={BONUS_TOOLTIP_TEXT} />
        </span>
      </td>
      {players.map((p) => {
        const bonus = upperBonus(p.scorecard);
        return (
          <td key={p.userId} className="px-2 py-1.5 text-center text-slate-400">
            {bonus > 0 ? (
              <span className="text-emerald-400">{bonus}</span>
            ) : (
              `${upperTotal(p.scorecard)}/63`
            )}
          </td>
        );
      })}
    </tr>
  );
};

/**
 * 최종 합계 줄.
 * @param props - 참가자 목록
 * @param props.players
 * @returns 테이블 행 엘리먼트
 */
const TotalRow = ({ players }: { players: PlayerRow[] }): JSX.Element => {
  return (
    <tr className="border-t border-slate-800 bg-slate-900">
      <td className="rounded-bl-xl py-2 pr-2 pl-4 text-base font-bold text-slate-100">
        합계
      </td>
      {players.map((p) => (
        <td
          key={p.userId}
          className="px-2 py-2 text-center text-base font-bold text-indigo-300 last:rounded-br-xl"
        >
          {p.total}
        </td>
      ))}
    </tr>
  );
};
