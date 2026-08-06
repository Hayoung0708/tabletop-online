"use client";

import type { FormEvent, JSX } from "react";

const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 16;

export interface NicknameFormProps {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onSubmit: (nickname: string) => void;
  joining: boolean;
  joinError: string | null;
}

/**
 * 방에 처음 들어왔을 때 보여주는 닉네임 입력 폼.
 * @param props - 닉네임 값/변경/제출 핸들러와 진행 상태
 * @param props.nickname
 * @param props.onNicknameChange
 * @param props.onSubmit
 * @param props.joining
 * @param props.joinError
 * @returns 닉네임 입력 폼 엘리먼트
 */
export const NicknameForm = ({
  nickname,
  onNicknameChange,
  onSubmit,
  joining,
  joinError,
}: NicknameFormProps): JSX.Element => {
  const isValid = nickname.trim().length >= MIN_NICKNAME_LENGTH;

  /**
   * 폼 기본 제출을 막고, 닉네임이 유효하면 참가를 요청한다.
   * @param e
   */
  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (isValid) onSubmit(nickname.trim());
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          placeholder="닉네임 (2~16자)"
          maxLength={MAX_NICKNAME_LENGTH}
          autoFocus
          className="rounded-lg bg-slate-800 px-4 py-3 outline-none ring-1 ring-slate-700 focus:ring-indigo-500"
        />
        {joinError && <p className="text-sm text-red-400">{joinError}</p>}
        <button
          type="submit"
          disabled={joining || !isValid}
          className="rounded-lg bg-indigo-600 py-3 font-medium transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {joining ? "입장하는 중..." : "이 닉네임으로 입장"}
        </button>
      </form>
    </div>
  );
};
