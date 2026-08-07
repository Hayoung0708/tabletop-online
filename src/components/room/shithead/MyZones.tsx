"use client";

import { useState, type JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { FaceCardSlots } from "@/components/room/shithead/FaceCardSlots";
import { CardFan } from "@/components/room/shithead/CardFan";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { canPlaySingleCard } from "@/server/shithead/deck";
import type { Card } from "@/server/shithead/deck";

export interface MyZonesProps {
  userId: string;
  hand: Card[];
  faceUp: Card[];
  faceDownCount: number;
  pile: Card[];
  isMyTurn: boolean;
  onPlayCards: (cardIds: string[]) => void;
  onPlayFaceDown: (index: number) => void;
  onPickUpPile: () => void;
}

/**
 * 내 손패/얼굴카드/뒷카드 영역. 손패가 있으면 손패에서, 없으면 얼굴카드,
 * 그것도 없으면 뒷카드를 뒤집어야 한다. 같은 랭크는 여러 장 선택해서 한
 * 번에 낼 수 있고, 지금 낼 수 없는 카드는 흐리게 표시하고 클릭을 막는다.
 * @param props - 내 카드 상태와 액션 콜백
 * @param props.userId
 * @param props.hand
 * @param props.faceUp
 * @param props.faceDownCount
 * @param props.pile
 * @param props.isMyTurn
 * @param props.onPlayCards
 * @param props.onPlayFaceDown
 * @param props.onPickUpPile
 * @returns 내 카드 영역 엘리먼트
 */
export const MyZones = ({
  userId,
  hand,
  faceUp,
  faceDownCount,
  pile,
  isMyTurn,
  onPlayCards,
  onPlayFaceDown,
  onPickUpPile,
}: MyZonesProps): JSX.Element => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const activeZone: Card[] = hand.length > 0 ? hand : faceUp;
  const isBlindPhase = hand.length === 0 && faceUp.length === 0;
  /**
   * 지금 이 카드를 더미 위에 낼 수 있는지 확인한다.
   * @param card - 확인할 카드
   * @returns 낼 수 있으면 true
   */
  const isLegal = (card: Card): boolean => canPlaySingleCard(pile, card);

  /**
   * 카드 선택을 토글한다. 이미 다른 랭크가 선택돼 있으면 새로 선택한 카드로 바꾼다.
   * @param card - 토글할 카드
   */
  const toggleCard = (card: Card): void => {
    if (!isMyTurn || !isLegal(card)) return;
    setSelectedIds((prev) => {
      if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
      const selectedRank = activeZone.find((c) => c.id === prev[0])?.rank;
      if (selectedRank && selectedRank !== card.rank) return [card.id];
      return [...prev, card.id];
    });
  };

  /** 선택된 카드를 낸다. */
  const handlePlay = (): void => {
    onPlayCards(selectedIds);
    setSelectedIds([]);
  };

  // 낼 수 있는 카드가 있어도 전략적으로 더미를 주울 수 있다. 블라인드 단계나
  // 빈 더미일 때만 막는다.
  const canPickUp = isMyTurn && !isBlindPhase && pile.length > 0;

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 pt-3 pb-4">
      <div
        data-anchor={SHITHEAD_ANCHOR.field(userId)}
        className="flex w-full items-end gap-6"
      >
        <FaceCardSlots
          faceUp={faceUp}
          faceDownCount={faceDownCount}
          selectedIds={hand.length === 0 ? selectedIds : undefined}
          anchorUserId={userId}
          isFaceUpLegal={hand.length === 0 ? isLegal : (): boolean => false}
          onToggleFaceUp={hand.length === 0 && isMyTurn ? toggleCard : undefined}
          onFlipFaceDown={isBlindPhase && isMyTurn ? onPlayFaceDown : undefined}
        />
        <div
          data-anchor={SHITHEAD_ANCHOR.hand(userId)}
          data-hand-align="end"
          className="flex min-h-[5.625rem] min-w-0 flex-1 items-end sm:min-h-[6.625rem]"
        >
          {hand.length > 0 && (
            <CardFan>
              {hand.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  selected={selectedIds.includes(card.id)}
                  disabled={!isLegal(card)}
                  onClick={isMyTurn ? (): void => toggleCard(card) : undefined}
                />
              ))}
            </CardFan>
          )}
        </div>
      </div>

      {!isBlindPhase && (
        <div className="flex w-full justify-center gap-2">
          <button
            onClick={handlePlay}
            disabled={!isMyTurn || selectedIds.length === 0}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-base font-medium transition hover:bg-indigo-500 disabled:opacity-40"
          >
            내기
          </button>
          <button
            onClick={onPickUpPile}
            disabled={!canPickUp}
            className="rounded-lg border border-slate-700 px-6 py-2.5 text-base font-medium transition hover:bg-slate-800 disabled:opacity-40"
          >
            줍기
          </button>
        </div>
      )}
      {isBlindPhase && isMyTurn && (
        <p className="text-sm text-slate-400">뒷카드를 한 장 뒤집어서 내주세요.</p>
      )}
    </div>
  );
};
