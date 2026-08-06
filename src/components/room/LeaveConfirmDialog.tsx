"use client";

import type { JSX, Ref } from "react";

export interface LeaveConfirmDialogProps {
  dialogRef: Ref<HTMLDialogElement>;
  onCancel: () => void;
  onLeave: () => void;
}

/**
 * 게임 진행 중 나가기를 눌렀을 때 뜨는 확인 다이얼로그.
 * @param props - 다이얼로그 ref와 취소/나가기 핸들러
 * @param props.dialogRef
 * @param props.onCancel
 * @param props.onLeave
 * @returns 다이얼로그 엘리먼트
 */
export const LeaveConfirmDialog = ({
  dialogRef,
  onCancel,
  onLeave,
}: LeaveConfirmDialogProps): JSX.Element => {
  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-black/60"
    >
      <h2 className="text-lg font-bold">정말 나가시겠습니까?</h2>
      <p className="mt-2 text-sm text-slate-400">
        게임이 진행 중입니다. 지금 나가면 패배로 처리되며, 이 게임에 다시 참여할 수
        없습니다.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-700 px-4 py-2 font-medium transition hover:bg-slate-800"
        >
          계속하기
        </button>
        <button
          onClick={onLeave}
          className="rounded-lg bg-red-600 px-4 py-2 font-medium transition hover:bg-red-500"
        >
          나가기
        </button>
      </div>
    </dialog>
  );
};
