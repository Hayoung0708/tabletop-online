"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { useDealing } from "@/components/room/shithead/DealingContext";
import { useFaceDownReveal } from "@/hooks/shithead/useFaceDownReveal";
import {
  FACE_DOWN_FLIP_HALF_MS,
  FACE_DOWN_FLIP_MS,
  SHITHEAD_ANCHOR,
} from "@/constants/shithead";
import type { Card } from "@/server/shithead/deck";

export interface FaceCardSlotsProps {
  faceUp: Card[];
  /** 바닥패 3자리 중 아직 카드가 남아있는 자리는 true (길이 고정). */
  faceDown: boolean[];
  selectedIds?: string[];
  /** 딜 애니메이션 대상 앵커를 붙일 플레이어 id. 없으면 앵커를 달지 않는다. */
  anchorUserId?: string;
  isFaceUpLegal?: (card: Card) => boolean;
  onToggleFaceUp?: (card: Card) => void;
  onFlipFaceDown?: (index: number) => void;
}

// 빈 자리(바닥패를 냄) 표시 — 덱/더미가 비었을 때와 같은 점선 박스.
const EMPTY_SLOT_CLASS =
  "absolute top-2.5 left-0 h-20 w-14 rounded-lg border-2 border-dashed border-slate-700 sm:h-24 sm:w-16";

export interface FaceDownFlipCardProps {
  card: Card;
}

/**
 * 바닥패 한 장이 그 자리에서 뒤집히는 애니메이션. 마운트되는 순간 뒷면에서
 * 시작해 옆으로 접혔다가(scaleX 0) 다시 펼쳐지고, 중간 지점에서 실제 카드로
 * 바꿔치기한다. 펼쳐진 뒤에는 실제 상태가 이 자리를 비웠다고 확인해줄
 * 때까지(useFaceDownReveal) 그대로 유지된다.
 * @param props - 뒤집을 카드 정보
 * @param props.card
 * @returns 뒤집기 오버레이 엘리먼트
 */
const FaceDownFlipCard = ({ card }: FaceDownFlipCardProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const [showFront, setShowFront] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [
        { transform: "scaleX(1)" },
        { transform: "scaleX(0)" },
        { transform: "scaleX(1)" },
      ],
      { duration: FACE_DOWN_FLIP_MS, easing: "ease-in-out", fill: "forwards" },
    );
    const timer = setTimeout(() => setShowFront(true), FACE_DOWN_FLIP_HALF_MS);
    return (): void => clearTimeout(timer);
  }, []);

  return (
    <div ref={ref} className="absolute top-2.5 left-0 z-10">
      {showFront ? <PlayingCard card={card} /> : <PlayingCard faceDown />}
    </div>
  );
};

/**
 * 바닥패 3자리를 겹치지 않게 왼쪽에 나열한다. 각 자리는 보이는 얼굴카드가
 * 위에, 그 밑으로 안 보이는 뒷카드가 살짝 튀어나온 모양이다. 얼굴카드를 다
 * 냈으면 그 자리엔 뒷카드만 남아서 블라인드로 뒤집는 자리가 된다. 자리는
 * 항상 고정 3칸이라, 뒷카드를 내도 그 칸은 점선 빈 자리로 남고 다른
 * 카드들이 당겨오지 않는다.
 * @param props - 얼굴카드/뒷카드 상태와 상호작용 콜백 (없으면 읽기 전용)
 * @param props.faceUp
 * @param props.faceDown
 * @param props.selectedIds
 * @param props.anchorUserId
 * @param props.isFaceUpLegal
 * @param props.onToggleFaceUp
 * @param props.onFlipFaceDown
 * @returns 바닥패 자리 엘리먼트
 */
export const FaceCardSlots = ({
  faceUp,
  faceDown,
  selectedIds,
  anchorUserId,
  isFaceUpLegal,
  onToggleFaceUp,
  onFlipFaceDown,
}: FaceCardSlotsProps): JSX.Element => {
  const dealing = useDealing();
  const reveal = useFaceDownReveal(anchorUserId, faceDown);

  return (
    <div className="flex gap-2">
      {faceDown.map((filled, i) => {
        const topCard = i < faceUp.length ? faceUp[i] : undefined;
        const revealing = reveal?.index === i ? reveal : null;
        return (
          <div
            key={i}
            data-anchor={
              anchorUserId ? SHITHEAD_ANCHOR.faceDownSlot(anchorUserId, i) : undefined
            }
            className="relative h-[5.625rem] w-14 shrink-0 sm:h-[6.625rem] sm:w-16"
          >
            {!dealing && revealing && <FaceDownFlipCard card={revealing.card} />}
            {!dealing && !revealing && !filled && !topCard && (
              <div className={EMPTY_SLOT_CLASS} />
            )}
            {!dealing && !revealing && filled && (
              <div className="absolute top-2.5 left-0 z-0">
                <PlayingCard
                  faceDown
                  onClick={
                    !topCard && onFlipFaceDown && !reveal
                      ? (): void => onFlipFaceDown(i)
                      : undefined
                  }
                />
              </div>
            )}
            {!dealing && !revealing && topCard && (
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
