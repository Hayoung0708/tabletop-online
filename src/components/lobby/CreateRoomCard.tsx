"use client";

import type { JSX } from "react";

export interface CreateRoomCardProps {
  onOpenDialog: () => void;
}

/**
 * "새 방 만들기" 다이얼로그를 여는 카드.
 * @param props - 다이얼로그 열기 핸들러
 * @param props.onOpenDialog
 * @returns 카드 엘리먼트
 */
export const CreateRoomCard = ({ onOpenDialog }: CreateRoomCardProps): JSX.Element => {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-5">
      <h2 className="text-lg font-semibold">새 방 만들기</h2>
      <button
        onClick={onOpenDialog}
        className="self-start rounded-lg bg-indigo-600 px-5 py-2.5 font-medium transition hover:bg-indigo-500"
      >
        방 만들기
      </button>
    </section>
  );
};
