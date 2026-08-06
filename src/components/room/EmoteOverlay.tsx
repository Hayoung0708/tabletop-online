"use client";

import type { JSX } from "react";
import { EMOTE_VIDEO_SRC } from "@/constants/media";
import type { ActiveEmote } from "@/hooks/useRoomSocket";

export interface EmoteOverlayProps {
  activeEmotes: ActiveEmote[];
  onRemoveEmote: (id: number) => void;
}

/**
 * 화면 위에 겹쳐 뜨는 감정표현 영상들을 그린다.
 * @param props - 활성 감정표현 목록과 제거 핸들러
 * @param props.activeEmotes
 * @param props.onRemoveEmote
 * @returns 오버레이 레이어 엘리먼트
 */
export const EmoteOverlay = ({
  activeEmotes,
  onRemoveEmote,
}: EmoteOverlayProps): JSX.Element => {
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {activeEmotes.map((e) => (
        <video
          key={e.id}
          src={EMOTE_VIDEO_SRC}
          autoPlay
          muted
          playsInline
          onEnded={() => onRemoveEmote(e.id)}
          onError={() => onRemoveEmote(e.id)}
          className="absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${e.x}%`, top: `${e.y}%` }}
        />
      ))}
    </div>
  );
};
