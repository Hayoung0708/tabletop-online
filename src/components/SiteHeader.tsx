"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ onExit }: { onExit?: () => void }) {
  const logo = (
    <>
      <Image src="/logo.svg" alt="" width={40} height={40} />
      <span className="ml-2">테이블탑 온라인</span>
    </>
  );

  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
      {onExit ? (
        // Inside a room: route through the same leave logic as the exit
        // button (leave_room emit, confirm-dialog while playing) instead of
        // a plain nav that would strand the server-side room membership.
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
}
