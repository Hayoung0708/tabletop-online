"use client";

import { useRef, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { useHandGrowIn } from "@/hooks/shithead/useHandGrowIn";
import { useHandDealInOnMount } from "@/hooks/shithead/useHandDealInOnMount";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { computeHandMargin } from "@/utils/shithead";
import type { PublicOneCardPlayer } from "@/server/onecard/gameLogic";

export interface OneCardOpponentRowProps {
  nickname: string;
  player: PublicOneCardPlayer;
  isCurrentTurn: boolean;
  /** 게임 시작 직후라 딜(덱에서 날아드는) 연출을 재생할지 여부. */
  dealIn: boolean;
}

/**
 * 원카드 상대 플레이어 한 명의 손패(뒷면) 영역. 원카드는 한 번에 한 장만
 * 내므로 싯헤드처럼 재정렬을 미루는 처리 없이 장수를 곧바로 반영한다.
 * 카드가 늘어날 때(먹기)는 useHandGrowIn이 덱에서 날아오는 연출을 붙인다.
 * @param props - 닉네임과 공개된 손패 상태
 * @param props.nickname
 * @param props.player
 * @param props.isCurrentTurn
 * @param props.dealIn
 * @returns 상대 손패 영역 엘리먼트
 */
export const OneCardOpponentRow = ({
  nickname,
  player,
  isCurrentTurn,
  dealIn,
}: OneCardOpponentRowProps): JSX.Element => {
  const handRef = useRef<HTMLDivElement>(null);
  // 손패 영역 폭을 재서 카드가 많아지면 겹침을 강하게 줘 넘치지 않게 한다.
  const [, handWidth] = useMeasuredWidth(handRef);
  // 게임 시작 직후에는 손패가 덱에서 날아드는 딜 연출을 재생한다.
  useHandDealInOnMount(handRef, dealIn);

  // 상대 손패는 뒷면이라 카드 구분이 없다 — 오른쪽 끝 기준 키를 매기면
  // 장수가 늘 때 새 카드가 맨 왼쪽으로 들어오고, 줄 때 왼쪽부터 빠진다.
  const handKeys = Array.from({ length: player.handCount }, (_, i) =>
    String(player.handCount - i),
  );
  useHandGrowIn(handRef, handKeys, player.userId, true);
  const handMarginPx = computeHandMargin(handKeys.length, handWidth);

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-2 pt-2 pb-3 sm:gap-2 sm:px-3 sm:pb-4 ${
        isCurrentTurn ? "border-indigo-500 bg-indigo-950/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 text-base font-semibold text-slate-200 sm:text-lg">
        <span className="truncate">{nickname}</span>
        {player.finishRank && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-400">
            {player.bankrupt ? "파산" : `${player.finishRank}등`}
          </span>
        )}
      </div>

      <div
        data-anchor={SHITHEAD_ANCHOR.field(player.userId)}
        className="flex w-full items-start"
      >
        {/* z-50: 비행 오버레이(z-40)보다 위 — 나가는 카드가 남은 카드들
            아래에 깔린 채 더미로 이동해야 자연스럽다. */}
        <div
          ref={handRef}
          data-anchor={SHITHEAD_ANCHOR.hand(player.userId)}
          data-hand-align="start"
          className="relative z-50 flex min-h-[5.625rem] min-w-0 flex-1 sm:min-h-[6.625rem]"
        >
          {handKeys.map((key, index) => (
            <div
              key={key}
              className="relative"
              style={{ marginLeft: index === 0 ? 0 : handMarginPx }}
            >
              <PlayingCard faceDown />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
