"use client";

import { useMemo, useState, type JSX } from "react";
import { CARD_ROW_MIN_H_CLASS, HAND_FAB_CLEARANCE_CLASS } from "@/constants/card";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { CardFan } from "@/components/room/shithead/CardFan";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { isLoneSeven, MIN_MELD_SIZE } from "@/server/hula/meld";
import type { HulaCard } from "@/server/hula/deck";

export interface HulaMyHandProps {
  userId: string;
  hand: HulaCard[];
  selectedIds: string[];
  isMyTurn: boolean;
  /** 이번 차례에 이미 카드를 가져왔는지. 가져와야 등록·버리기를 할 수 있다. */
  hasDrawn: boolean;
  /** 게임 시작 직후라 딜 연출을 재생할지 여부. */
  dealIn: boolean;
  /** 아직 쓰지 않은 땡큐 카드 id. 있으면 버리는 대신 취소만 할 수 있다. */
  thankYouCardId: string | null;
  /** 스톱을 부를 수 있는지 (손패 합이 상한 이하이고 아직 안 가져왔을 때). */
  canStop: boolean;
  onToggleCard: (cardId: string) => void;
  onRegister: () => void;
  onDiscard: () => void;
  onCancelThankYou: () => void;
  onStop: () => void;
}

/**
 * 내 손패 영역. 카드를 여러 장 골라 조합으로 등록하거나, 한 장만 골라 버린다.
 * 남의 조합에 붙일 때도 한 장을 고른 뒤 위쪽 조합을 클릭한다.
 * @param props - 손패 상태와 액션 콜백
 * @param props.userId
 * @param props.hand
 * @param props.selectedIds
 * @param props.isMyTurn
 * @param props.hasDrawn
 * @param props.dealIn
 * @param props.thankYouCardId - 아직 못 쓴 땡큐 카드
 * @param props.canStop - 스톱을 부를 수 있는지
 * @param props.onToggleCard
 * @param props.onRegister
 * @param props.onDiscard
 * @param props.onCancelThankYou - 땡큐 취소 콜백
 * @param props.onStop - 스톱 선언 콜백
 * @returns 내 손패 영역 엘리먼트
 */
export const HulaMyHand = ({
  userId,
  hand,
  selectedIds,
  isMyTurn,
  hasDrawn,
  dealIn,
  thankYouCardId,
  canStop,
  onToggleCard,
  onRegister,
  onDiscard,
  onCancelThankYou,
  onStop,
}: HulaMyHandProps): JSX.Element => {
  // 드래그로 바꾼 손패 순서. 서버는 정렬해서 보내주지만, 직접 옮긴 배치가
  // 있으면 그쪽을 우선한다. 새로 가져온 카드는 맨 앞에 붙인다.
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const ordered = useMemo(() => {
    const byId = new Map(hand.map((card) => [card.id, card]));
    const kept = manualOrder
      .map((id) => byId.get(id))
      .filter((card): card is HulaCard => card !== undefined);
    const keptIds = new Set(kept.map((card) => card.id));
    const added = hand.filter((card) => !keptIds.has(card.id));
    return [...added, ...kept];
  }, [hand, manualOrder]);

  const canAct = isMyTurn && hasDrawn;
  // 7은 한 장만으로도 등록할 수 있어 장수 조건이 다르다.
  const selected = hand.filter((card) => selectedIds.includes(card.id));
  const canRegister =
    canAct && (selected.length >= MIN_MELD_SIZE || isLoneSeven(selected));

  return (
    <div
      className={`flex flex-col items-start gap-3 rounded-xl border bg-slate-900/40 px-3 pt-3 pb-4 ${
        isMyTurn ? "border-indigo-500" : "border-slate-800"
      }`}
    >
      <div data-anchor={SHITHEAD_ANCHOR.field(userId)} className="flex w-full items-end">
        <div
          data-anchor={SHITHEAD_ANCHOR.hand(userId)}
          data-hand-align="end"
          className={`flex ${CARD_ROW_MIN_H_CLASS} ${HAND_FAB_CLEARANCE_CLASS} min-w-0 flex-1 items-end`}
        >
          <CardFan
            cardKeys={ordered.map((c) => c.id)}
            playerId={userId}
            dealInOnMount={dealIn}
            onReorder={setManualOrder}
          >
            {ordered.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                selected={selectedIds.includes(card.id)}
                highlighted={card.id === thankYouCardId}
                onClick={canAct ? (): void => onToggleCard(card.id) : undefined}
              />
            ))}
          </CardFan>
        </div>
      </div>

      {thankYouCardId && (
        <p className="w-full text-center text-sm text-amber-300">
          땡큐한 카드는 이번 차례에 등록하거나 붙여야 합니다
        </p>
      )}

      <div className="flex w-full flex-wrap justify-center gap-2">
        <button
          onClick={onRegister}
          disabled={!canRegister}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium sm:px-6 sm:py-2.5 sm:text-base transition hover:bg-indigo-500 disabled:opacity-40"
        >
          등록
        </button>
        {/* 땡큐한 카드를 아직 못 썼으면 차례를 끝낼 수 없다 — 버리기 자리에
            취소 버튼을 둬서 물러날 길만 남긴다. */}
        {thankYouCardId ? (
          <button
            onClick={onCancelThankYou}
            className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-300 sm:px-6 sm:py-2.5 sm:text-base transition hover:bg-amber-950"
          >
            땡큐 취소
          </button>
        ) : (
          <button
            onClick={onDiscard}
            disabled={!canAct || selectedIds.length !== 1}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium sm:px-6 sm:py-2.5 sm:text-base transition hover:bg-slate-800 disabled:opacity-40"
          >
            버리기
          </button>
        )}
        {canStop && (
          <button
            onClick={onStop}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 sm:px-6 sm:py-2.5 sm:text-base transition hover:bg-amber-400"
          >
            스톱!
          </button>
        )}
      </div>
    </div>
  );
};
