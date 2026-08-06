"use client";

import { useState, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { FaceCardSlots } from "@/components/room/shithead/FaceCardSlots";
import type { Card } from "@/server/shithead/deck";

const FACE_UP_PICK_SIZE = 3;
const FACE_DOWN_SIZE = 3;

export interface FaceUpSelectionProps {
  hand: Card[];
  onConfirm: (cardIds: string[]) => void;
}

/**
 * 딜 직후 손패 6장 중 바닥패(얼굴카드)로 놓을 3장을 고르는 화면. 다른
 * 플레이어와 같은 레이아웃(바닥패 왼쪽, 손패 오른쪽)을 그대로 써서 고르는
 * 중에도 실제 플레이 화면과 이질감이 없게 한다.
 * @param props - 손패와 확정 콜백
 * @param props.hand
 * @param props.onConfirm
 * @returns 선택 화면 엘리먼트
 */
export const FaceUpSelection = ({
  hand,
  onConfirm,
}: FaceUpSelectionProps): JSX.Element => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /**
   * 카드 선택을 토글한다 (최대 3장).
   * @param card - 토글할 카드
   */
  const toggleCard = (card: Card): void => {
    setSelectedIds((prev) => {
      if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
      if (prev.length >= FACE_UP_PICK_SIZE) return prev;
      return [...prev, card.id];
    });
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <p className="text-sm text-slate-400">바닥패로 놓을 카드 3장을 선택하세요.</p>

      <div className="flex items-end gap-6">
        <FaceCardSlots faceUp={[]} faceDownCount={FACE_DOWN_SIZE} />
        <div className="flex flex-wrap gap-2">
          {hand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              selected={selectedIds.includes(card.id)}
              onClick={(): void => toggleCard(card)}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => onConfirm(selectedIds)}
        disabled={selectedIds.length !== FACE_UP_PICK_SIZE}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-base font-medium transition hover:bg-indigo-500 disabled:opacity-40"
      >
        바닥패로 놓기 ({selectedIds.length}/{FACE_UP_PICK_SIZE})
      </button>
    </div>
  );
};
