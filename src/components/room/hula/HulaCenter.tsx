"use client";

import { useEffect, useState, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { CARD_FLIGHT_DURATION_MS, SHITHEAD_ANCHOR } from "@/constants/shithead";
import type { HulaCard } from "@/server/hula/deck";
import type { HulaDrawSource } from "@/server/hula/gameLogic";

const EMPTY_SLOT_CLASS =
  "flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 sm:h-24 sm:w-16";

export interface HulaCenterProps {
  deckCount: number;
  discard: HulaCard[];
  /** 덱에서 가져올 수 있는지 — 내 차례이고, 땡큐 대기 시간이 지난 뒤. */
  canDrawDeck: boolean;
  /** 더미에서 가져올 수 있는지(땡큐) — 아직 아무도 안 가져갔으면 누구나. */
  canDrawDiscard: boolean;
  onDraw: (source: HulaDrawSource) => void;
}

/**
 * 훌라 가운데 영역: 덱과 더미. 가져올 수 있을 때 둘 중 하나를 클릭한다.
 * 카드를 버리면 비행 연출이 착지할 때까지 새 top을 감춘다.
 * @param props - 덱·더미 상태와 가져오기 콜백
 * @param props.deckCount
 * @param props.discard
 * @param props.isMyTurn - 지금이 내 차례인지
 * @param props.canDrawDeck - 덱을 누를 수 있는지
 * @param props.canDrawDiscard - 더미를 누를 수 있는지
 * @param props.onDraw
 * @returns 가운데 영역 엘리먼트
 */
export const HulaCenter = ({
  deckCount,
  discard,
  canDrawDeck,
  canDrawDiscard,
  onDraw,
}: HulaCenterProps): JSX.Element => {
  // 렌더 단계에서 더미 증가를 즉시 감지해 새 top을 감춘다 — 그러지 않으면
  // 카드가 날아오기도 전에 더미에 먼저 나타나고, 그 위로 또 한 장이 날아온다.
  const [lastLen, setLastLen] = useState(discard.length);
  const [held, setHeld] = useState(false);
  if (discard.length !== lastLen) {
    setLastLen(discard.length);
    setHeld(discard.length > lastLen);
  }

  useEffect(() => {
    if (!held) return;
    /** 비행 카드가 착지하는 순간(또는 예비 타임아웃)에 감춤을 푼다. */
    const reveal = (): void => setHeld(false);
    window.addEventListener("shithead_play_landed", reveal);
    const fallback = setTimeout(reveal, CARD_FLIGHT_DURATION_MS + 600);
    return (): void => {
      window.removeEventListener("shithead_play_landed", reveal);
      clearTimeout(fallback);
    };
  }, [held]);

  const visibleLen = discard.length - (held ? 1 : 0);
  const top = discard[visibleLen - 1];

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <p className="min-h-5 text-sm text-slate-400">
        {canDrawDeck
          ? "덱이나 더미에서 한 장 가져오세요"
          : canDrawDiscard
            ? "더미를 가져가면 땡큐입니다"
            : ""}
      </p>
      <div className="flex items-start justify-center gap-4 sm:gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <div data-anchor={SHITHEAD_ANCHOR.deck}>
            {deckCount > 0 ? (
              <PlayingCard
                faceDown
                onClick={canDrawDeck ? (): void => onDraw("deck") : undefined}
              />
            ) : (
              <div className={EMPTY_SLOT_CLASS} />
            )}
          </div>
          <span className="text-sm text-slate-400">덱 {deckCount}장</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div
            data-anchor={SHITHEAD_ANCHOR.pile}
            className="relative h-20 w-14 sm:h-24 sm:w-16"
          >
            <div className={EMPTY_SLOT_CLASS} />
            {top && (
              <div className="absolute inset-0">
                <PlayingCard
                  key={top.id}
                  card={top}
                  onClick={canDrawDiscard ? (): void => onDraw("discard") : undefined}
                />
              </div>
            )}
          </div>
          <span className="text-sm text-slate-400">더미 {visibleLen}장</span>
        </div>
      </div>
    </div>
  );
};
