"use client";

import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";

export interface SiteHeaderProps {
  onExit?: () => void;
}

/**
 * 로고 + 제목을 보여주는 공통 헤더. onExit이 있으면(방 안에서는) 로고 클릭도
 * 나가기 로직(leave_room emit, 진행 중이면 확인 다이얼로그)을 거치도록 만든다.
 * @param props - onExit 콜백
 * @param props.onExit
 * @returns 헤더 엘리먼트
 */
export const SiteHeader = ({ onExit }: SiteHeaderProps): JSX.Element => {
  const logo = (
    <>
      <Image src="/logo.svg" alt="" width={40} height={40} />
      <span className="ml-2">테이블탑 온라인</span>
    </>
  );

  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
      {onExit ? (
        <button onClick={onExit} className="flex items-center text-lg font-bold">
          {logo}
        </button>
      ) : (
        <Link href="/lobby" className="flex items-center text-lg font-bold">
          {logo}
        </Link>
      )}

      {onExit && (
        <button
          onClick={onExit}
          title="방 나가기"
          aria-label="방 나가기"
          className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      )}
    </header>
  );
};
