"use client";

import type { FormEvent, JSX, MouseEvent, Ref } from "react";
import { Check } from "lucide-react";
import { GAMES } from "@/constants/games";
import type { UseCreateRoomFormResult } from "@/hooks/useCreateRoomForm";

const ROOM_NAME_MAX_LENGTH = 20;

export interface CreateRoomDialogProps {
  dialogRef: Ref<HTMLDialogElement>;
  form: UseCreateRoomFormResult;
  onRequestClose: () => void;
}

/**
 * 게임 선택, 방 이름, 비밀방 여부를 입력받는 "새 방 만들기" 다이얼로그.
 * @param props - 다이얼로그 ref와 폼 상태
 * @param props.dialogRef
 * @param props.form
 * @param props.onRequestClose
 * @returns 다이얼로그 엘리먼트
 */
export const CreateRoomDialog = ({
  dialogRef,
  form,
  onRequestClose,
}: CreateRoomDialogProps): JSX.Element => {
  /**
   * 폼 기본 제출을 막고 방 생성을 요청한다.
   * @param e
   */
  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    void form.submit();
  };

  /**
   * 다이얼로그 바깥(배경) 클릭이면 닫는다. 안쪽 클릭은 그냥 통과시킨다.
   * @param e - 클릭 이벤트
   */
  const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) onRequestClose();
  };

  const gameLabel = GAMES.find((g) => g.id === form.gameType)?.label ?? "";

  return (
    <dialog
      ref={dialogRef}
      onClose={form.clearError}
      onClick={handleBackdropClick}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-black/60"
    >
      <form method="dialog" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h2 className="text-2xl font-bold">새 방 만들기</h2>

        <div className="flex flex-col gap-2">
          <span className="text-base font-medium text-slate-300">게임 선택</span>
          <div className="grid grid-cols-2 gap-2">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={g.disabled}
                onClick={() => form.setGameType(g.id)}
                aria-pressed={form.gameType === g.id}
                className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-5 transition ${
                  g.disabled
                    ? "cursor-default border-slate-800 bg-slate-800/40 text-slate-500"
                    : form.gameType === g.id
                      ? "border-indigo-500 bg-indigo-950"
                      : "border-slate-700 bg-slate-800 hover:border-slate-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.icon}
                  alt=""
                  className={`h-24 w-24 ${g.disabled ? "opacity-40" : ""}`}
                />
                <span className="-mt-3 text-lg font-semibold">{g.label}</span>
                <span className="text-center text-sm text-slate-400">{g.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-base font-medium text-slate-300">방 이름</span>
          <input
            value={form.roomName}
            onChange={(e) => form.setRoomName(e.target.value)}
            placeholder={`${gameLabel} 한 판`}
            maxLength={ROOM_NAME_MAX_LENGTH}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-base outline-none ring-1 ring-slate-700 focus:ring-indigo-500"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-3">
          <input
            type="checkbox"
            checked={form.isPrivate}
            onChange={(e) => form.setIsPrivate(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
              form.isPrivate
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-slate-600 bg-slate-800 text-transparent"
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={4} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-medium">비밀방</span>
            <span className="text-sm text-slate-400">
              공개 방 목록에 나타나지 않고, 방 코드로만 입장할 수 있습니다.
            </span>
          </span>
        </label>

        {form.error && <p className="text-sm text-red-400">{form.error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onRequestClose}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-base font-medium transition hover:bg-slate-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={form.creating}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-base font-medium transition hover:bg-indigo-500 disabled:opacity-50"
          >
            만들기
          </button>
        </div>
      </form>
    </dialog>
  );
};
