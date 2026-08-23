"use client";

import type { JSX } from "react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import type { HulaMeld } from "@/server/hula/meld";

export interface HulaMeldBoardProps {
  melds: HulaMeld[];
  /** 조합을 등록한 사람의 닉네임을 찾는 함수. */
  nicknameOf: (userId: string) => string;
  /** 지금 카드를 붙일 수 있는지 (한 장 고른 상태 + 내가 등록 완료). */
  canAppend: boolean;
  onAppend: (meldId: string) => void;
}

/**
 * 바닥에 등록된 조합들을 등록한 사람별로 묶어 보여준다. 손패에서 한 장을 고른
 * 상태면 조합을 클릭해 카드를 붙일 수 있다.
 * @param props - 조합 목록과 붙이기 콜백
 * @param props.melds
 * @param props.nicknameOf
 * @param props.canAppend
 * @param props.onAppend
 * @returns 조합 목록 엘리먼트
 */
export const HulaMeldBoard = ({
  melds,
  nicknameOf,
  canAppend,
  onAppend,
}: HulaMeldBoardProps): JSX.Element => {
  if (melds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-center text-sm text-slate-500">
        아직 등록된 조합이 없습니다
      </div>
    );
  }

  // 같은 사람이 여러 조합을 등록해도 박스는 하나 — 그 안에서 조합끼리만 띄운다.
  const owners = [...new Set(melds.map((meld) => meld.ownerId))];

  return (
    <div className="flex flex-wrap gap-3">
      {owners.map((ownerId) => (
        <div
          key={ownerId}
          className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2"
        >
          <span className="text-xs text-slate-400">{nicknameOf(ownerId)}</span>
          <div className="flex flex-wrap gap-4">
            {melds
              .filter((meld) => meld.ownerId === ownerId)
              .map((meld) => (
                <button
                  key={meld.id}
                  type="button"
                  onClick={canAppend ? (): void => onAppend(meld.id) : undefined}
                  disabled={!canAppend}
                  className={`flex rounded-lg border p-1 transition ${
                    canAppend
                      ? "cursor-pointer border-indigo-600 hover:bg-slate-800"
                      : "border-transparent"
                  }`}
                >
                  {meld.cards.map((card, index) => (
                    <div
                      key={card.id}
                      style={{ marginLeft: index === 0 ? 0 : "-1.75rem" }}
                    >
                      <PlayingCard card={card} />
                    </div>
                  ))}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};
