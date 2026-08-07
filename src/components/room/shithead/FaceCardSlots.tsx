"use client";

import type { JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import type { Card } from "@/server/shithead/deck";

export interface FaceCardSlotsProps {
  faceUp: Card[];
  faceDownCount: number;
  selectedIds?: string[];
  isFaceUpLegal?: (card: Card) => boolean;
  onToggleFaceUp?: (card: Card) => void;
  onFlipFaceDown?: (index: number) => void;
}

/**
 * 바닥패 3자리를 겹치지 않게 왼쪽에 나열한다. 각 자리는 보이는 얼굴카드가
 * 위에, 그 밑으로 안 보이는 뒷카드가 살짝 튀어나온 모양이다. 얼굴카드를 다
 * 냈으면 그 자리엔 뒷카드만 남아서 블라인드로 뒤집는 자리가 된다.
 * @param props - 얼굴카드/뒷카드 상태와 상호작용 콜백 (없으면 읽기 전용)
 * @param props.faceUp
 * @param props.faceDownCount
 * @param props.selectedIds
 * @param props.isFaceUpLegal
 * @param props.onToggleFaceUp
 * @param props.onFlipFaceDown
 * @returns 바닥패 자리 엘리먼트
 */
export const FaceCardSlots = ({
  faceUp,
  faceDownCount,
  selectedIds,
  isFaceUpLegal,
  onToggleFaceUp,
  onFlipFaceDown,
}: FaceCardSlotsProps): JSX.Element => {
  return (
    <div className="flex gap-2">
      {Array.from({ length: faceDownCount }, (_, i) => {
        const topCard = i < faceUp.length ? faceUp[i] : undefined;
        return (
          <div
            key={i}
            className="relative h-[5.625rem] w-14 shrink-0 sm:h-[6.625rem] sm:w-16"
          >
            <div className="absolute top-2.5 left-0 z-0">
              <PlayingCard
                faceDown
                onClick={
                  !topCard && onFlipFaceDown ? (): void => onFlipFaceDown(i) : undefined
                }
              />
            </div>
            {topCard && (
              <div className="absolute top-0 left-0 z-10">
                <PlayingCard
                  card={topCard}
                  selected={selectedIds?.includes(topCard.id)}
                  disabled={isFaceUpLegal ? !isFaceUpLegal(topCard) : undefined}
                  onClick={
                    onToggleFaceUp ? (): void => onToggleFaceUp(topCard) : undefined
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
