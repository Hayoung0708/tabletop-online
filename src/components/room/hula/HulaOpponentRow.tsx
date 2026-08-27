"use client";

import { useRef, type CSSProperties, type JSX } from "react";
import { CARD_ROW_MIN_H_CLASS } from "@/constants/card";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { useHandGrowIn } from "@/hooks/shithead/useHandGrowIn";
import { useHandDealInOnMount } from "@/hooks/shithead/useHandDealInOnMount";
import { useHandMetrics } from "@/hooks/shithead/useHandMetrics";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { computeHandMargin } from "@/utils/shithead";
import { HULA_REVEAL_DURATION_MS, HULA_REVEAL_STAGGER_MS } from "@/constants/hula";
import type { PublicHulaPlayer } from "@/server/hula/gameLogic";

/**
 * 공개된 손패 한 장을 뒤집는 연출 스타일. 카드마다 조금씩 늦게 뒤집혀
 * 왼쪽부터 차례로 넘어가는 것처럼 보인다.
 * @param index - 손패에서 몇 번째 카드인지
 * @returns 인라인 스타일
 */
const revealStyle = (index: number): CSSProperties => ({
  animationDelay: `${index * HULA_REVEAL_STAGGER_MS}ms`,
  // animate.css는 재생 시간을 이 변수로 받는다.
  ["--animate-duration" as string]: `${HULA_REVEAL_DURATION_MS}ms`,
});

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
  useHandDealInOnMount(handRef, dealIn);

  // 상대 손패는 뒷면이라 카드 구분이 없다 — 오른쪽 끝 기준 키를 매기면
  // 장수가 늘 때 새 카드가 맨 왼쪽으로 들어오고, 줄 때 왼쪽부터 빠진다.
  const handKeys = Array.from({ length: player.handCount }, (_, i) =>
    String(player.handCount - i),
  );
  // 판이 끝나면 서버가 상대 손패를 실제 카드로 내려준다 — 그때는 뒷면 대신
  // 카드를 뒤집는 연출로 보여준다.
  const revealedHand = player.hand;
  useHandGrowIn(handRef, handKeys, player.userId, true);
  const { width: handWidth, cardWidth } = useHandMetrics(handRef, handKeys.length);
  const handMarginPx = computeHandMargin(handKeys.length, handWidth, cardWidth);

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-2 pt-2 pb-3 sm:gap-2 sm:px-3 sm:pb-4 ${
        isCurrentTurn ? "border-indigo-500 bg-indigo-950/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 text-base font-semibold text-slate-200 sm:text-lg">
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
          // 공개된 손패는 겹치면 숫자가 가려 확인할 수 없다 — 겹침을 풀고
          // 줄바꿈으로 전부 보여준다.
          className={`relative z-50 flex ${CARD_ROW_MIN_H_CLASS} min-w-0 flex-1 ${
            revealedHand ? "flex-wrap gap-1" : ""
          }`}
        >
          {revealedHand
            ? revealedHand.map((card, index) => (
                <div
                  key={card.id}
                  className="animate__animated animate__flipInY relative"
                  style={revealStyle(index)}
                >
                  <PlayingCard card={card} />
                </div>
              ))
            : handKeys.map((key, index) => (
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
