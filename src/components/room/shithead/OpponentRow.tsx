"use client";

import type { JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { FaceCardSlots } from "@/components/room/shithead/FaceCardSlots";
import type { PublicShitheadPlayer } from "@/server/shithead/gameLogic";

export interface OpponentRowProps {
  nickname: string;
  player: PublicShitheadPlayer;
  isCurrentTurn: boolean;
  showSelectionStatus: boolean;
}

/**
 * 다른 플레이어 한 명의 카드 상태. 바닥패는 왼쪽에 겹치지 않게, 손패는
 * 그 오른쪽에 뒷면으로 겹쳐서 보여준다 (얼굴카드/손패 실제 개수만 공개됨).
 * 바닥패 선택 단계에는 닉네임 옆에 완료/진행중 아이콘을 보여준다.
 * @param props - 닉네임과 공개된 카드 상태
 * @param props.nickname
 * @param props.player
 * @param props.isCurrentTurn
 * @param props.showSelectionStatus
 * @returns 상대방 카드 영역 엘리먼트
 */
export const OpponentRow = ({
  nickname,
  player,
  isCurrentTurn,
  showSelectionStatus,
}: OpponentRowProps): JSX.Element => {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-3 py-2 ${
        isCurrentTurn ? "border-indigo-500 bg-indigo-950/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <span className="truncate">{nickname}</span>
        {player.finishRank && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
            {player.finishRank}등
          </span>
        )}
        {showSelectionStatus &&
          (player.selectionDone ? (
            <span className="text-emerald-400" title="바닥패 선택 완료">
              ✅
            </span>
          ) : (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300"
              title="바닥패 선택중..."
            />
          ))}
      </div>

      <div className="flex items-end gap-6">
        <FaceCardSlots faceUp={player.faceUp} faceDownCount={player.faceDownCount} />
        <div className="flex -space-x-9">
          {Array.from({ length: player.handCount }, (_, i) => (
            <PlayingCard key={i} faceDown />
          ))}
        </div>
      </div>
    </div>
  );
};
