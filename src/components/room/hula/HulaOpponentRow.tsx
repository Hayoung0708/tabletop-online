"use client";

import { useRef, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { useHandGrowIn } from "@/hooks/shithead/useHandGrowIn";
import { useHandDealInOnMount } from "@/hooks/shithead/useHandDealInOnMount";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { computeHandMargin } from "@/utils/shithead";
import type { PublicHulaPlayer } from "@/server/hula/gameLogic";

export interface HulaOpponentRowProps {
  nickname: string;
  player: PublicHulaPlayer;
  isCurrentTurn: boolean;
  /** 게임 시작 직후라 딜 연출을 재생할지 여부. */
  dealIn: boolean;
}

/**
 * 훌라 상대 플레이어 한 명의 손패(뒷면) 영역. 조합을 등록한 사람은 배지로
 * 표시해, 지금 붙이기를 할 수 있는 상대인지 한눈에 보이게 한다.
 * @param props - 닉네임과 공개된 손패 상태
 * @param props.nickname
 * @param props.player
 * @param props.isCurrentTurn
 * @param props.dealIn
 * @returns 상대 손패 영역 엘리먼트
 */
export const HulaOpponentRow = ({
  nickname,
  player,
  isCurrentTurn,
  dealIn,
}: HulaOpponentRowProps): JSX.Element => {
  const handRef = useRef<HTMLDivElement>(null);
  const [, handWidth] = useMeasuredWidth(handRef);
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
      className={`flex flex-col gap-2 rounded-lg border px-3 pt-2 pb-4 ${
        isCurrentTurn ? "border-indigo-500 bg-indigo-950/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
        <span className="truncate">{nickname}</span>
        {player.registered && (
          <span className="rounded bg-emerald-900 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
            등록
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
