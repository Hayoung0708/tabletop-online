"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Smile, X } from "lucide-react";
import { EmoteButton } from "@/components/room/EmoteButton";
import { EMOTES } from "@/constants/media";

export interface EmoteFabProps {
  onSendEmote: (emoteId: string) => void;
  /** 감정표현별 쿨타임 진행 여부 — true인 동안 버튼을 비활성화한다. */
  emoteOnCooldown: Record<string, boolean>;
}

/**
 * 좁은 화면 전용 감정표현 버튼. 사이드바가 위쪽 가로 줄로 눕으면 감정표현까지
 * 넣을 자리가 없어서, 오른쪽 아래에 떠 있는 버튼으로 옮겨 놓는다. 누르면
 * 위쪽으로 감정표현 목록이 펼쳐지고, 하나 고르면 바로 닫힌다.
 * @param props - 감정표현 전송 콜백과 쿨타임 상태
 * @param props.onSendEmote - 감정표현 전송 콜백
 * @param props.emoteOnCooldown - 감정표현별 쿨타임 상태
 * @returns 플로팅 감정표현 버튼 엘리먼트
 */
export const EmoteFab = ({
  onSendEmote,
  emoteOnCooldown,
}: EmoteFabProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 펼친 목록 바깥을 누르면 닫는다 — 게임판을 누르려다 목록에 가려지면 답답하다.
  useEffect(() => {
    if (!open) return;
    /**
     * 바깥 클릭이면 목록을 닫는다.
     * @param event - 포인터 이벤트
     */
    const onPointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return (): void => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /**
   * 감정표현을 보내고 목록을 닫는다.
   * @param emoteId - 보낼 감정표현 id
   */
  const handleSend = (emoteId: string): void => {
    onSendEmote(emoteId);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed right-3 bottom-3 z-50 flex flex-col items-end gap-2 lg:hidden"
    >
      {open && (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-xl">
          {EMOTES.map((emote) => (
            <EmoteButton
              key={emote.id}
              emote={emote}
              onCooldown={emoteOnCooldown[emote.id] ?? false}
              onClick={(): void => handleSend(emote.id)}
              iconClassName="h-9 w-9"
              className="h-12 w-12 text-2xl"
            />
          ))}
        </div>
      )}

      <button
        onClick={(): void => setOpen((prev) => !prev)}
        aria-label="감정표현"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-500"
      >
        {open ? <X className="h-6 w-6" /> : <Smile className="h-6 w-6" />}
      </button>
    </div>
  );
};
