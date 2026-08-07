"use client";

import { useEffect, type JSX } from "react";
import { EMOTES, GIF_EMOTE_DURATION_MS } from "@/constants/media";
import type { ActiveEmote } from "@/hooks/useRoomSocket";

export interface EmotePlayerProps {
  emote: ActiveEmote;
  onRemove: () => void;
}

const MEDIA_CLASS = "h-full w-full object-contain";

/**
 * 감정표현 하나를 부모가 정해준 정사각형 슬롯 안에 꽉 채워 재생한다.
 * webm은 재생이 끝나면, gif는 고정 시간 뒤에 스스로 사라진다 (gif는
 * 재생 종료 이벤트가 없어서).
 * @param props - 감정표현 데이터와 제거 핸들러
 * @param props.emote
 * @param props.onRemove
 * @returns 감정표현 엘리먼트, 정의되지 않은 emoteId면 null
 */
export const EmotePlayer = ({
  emote,
  onRemove,
}: EmotePlayerProps): JSX.Element | null => {
  const def = EMOTES.find((e) => e.id === emote.emoteId);
  const isGif = def?.media.endsWith(".gif");

  useEffect(() => {
    if (!isGif) return;
    const timer = setTimeout(onRemove, GIF_EMOTE_DURATION_MS);
    return (): void => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGif]);

  if (!def) return null;

  if (isGif) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={def.media} alt="" className={MEDIA_CLASS} />;
  }

  return (
    <video
      src={def.media}
      autoPlay
      muted
      playsInline
      onEnded={onRemove}
      onError={onRemove}
      className={MEDIA_CLASS}
    />
  );
};
