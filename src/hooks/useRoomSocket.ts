"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { EMOTE_AUDIO_SRC } from "@/constants/media";
import { playSound } from "@/utils/sound";
import { useToast, type ToastMsg } from "@/hooks/useToast";
import type { PublicRoomState } from "@/server/roomManager";

export interface ActiveEmote {
  id: number;
  x: number;
  y: number;
}

export interface UseRoomSocketResult {
  state: PublicRoomState | null;
  error: string | null;
  toast: ToastMsg;
  activeEmotes: ActiveEmote[];
  removeEmote: (id: number) => void;
}

let emoteIdSeq = 0;

/**
 * 방 소켓 연결을 열고 room_state / error_message / emote 이벤트를 구독한다.
 * joined가 true가 되기 전에는 연결하지 않는다 (닉네임 입력 전이므로).
 * @param code - 방 코드
 * @param joined - 닉네임 입력을 마치고 참가했는지 여부
 * @param userId - 내 게스트 식별자
 * @returns 최신 방 상태, 에러 메시지, 토스트, 화면에 떠 있는 감정표현 목록
 */
export const useRoomSocket = (
  code: string,
  joined: boolean,
  userId: string,
): UseRoomSocketResult => {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const [activeEmotes, setActiveEmotes] = useState<ActiveEmote[]>([]);
  // 소켓 핸들러 안에서 비교할 마지막 상태 — effect 안에서 비교하면 React의
  // 개발 모드 이펙트 이중 실행이 기준값을 망가뜨릴 수 있어 ref로 둔다.
  const lastStateRef = useRef<PublicRoomState | null>(null);

  useEffect(() => {
    if (!joined) return;

    const socket = getSocket();

    /** 서버에 이 방에 참가한다고 알린다. */
    const join = (): void => {
      socket.emit("join_room", { code });
    };

    /**
     * 새 방 상태를 받아 반영하고, 게임 중 나간 사람이 있으면 토스트를 띄운다.
     * @param next
     */
    const onRoomState = (next: PublicRoomState): void => {
      const prev = lastStateRef.current;
      lastStateRef.current = next;

      if (prev?.status === "PLAYING") {
        const left = prev.players.filter((p) => {
          if (!p.connected || p.userId === userId) return false;
          const stillThere = next.players.find((x) => x.userId === p.userId);
          return !stillThere || !stillThere.connected;
        });
        if (left.length > 0) {
          setToast({
            text:
              left.length === 1
                ? `${left[0].nickname}님이 게임을 나갔습니다.`
                : `${left[0].nickname}님 외 ${left.length - 1}명이 게임을 나갔습니다.`,
          });
        }
      }

      setState(next);
      setError(null);
    };

    /**
     * 서버가 보낸 에러 메시지를 표시한다.
     * @param message
     */
    const onError = (message: string): void => {
      setError(message);
    };

    /**
     * 다른 플레이어가 보낸 감정표현을 화면에 추가한다.
     * @param root0
     * @param root0.x
     * @param root0.y
     */
    const onEmote = ({ x, y }: { x: number; y: number }): void => {
      emoteIdSeq += 1;
      setActiveEmotes((prev) => [...prev, { id: emoteIdSeq, x, y }]);
      playSound(EMOTE_AUDIO_SRC);
    };

    socket.on("connect", join);
    socket.on("room_state", onRoomState);
    socket.on("error_message", onError);
    socket.on("emote", onEmote);

    if (socket.connected) join();

    return (): void => {
      socket.off("connect", join);
      socket.off("room_state", onRoomState);
      socket.off("error_message", onError);
      socket.off("emote", onEmote);
    };
  }, [code, joined, userId, setToast]);

  /**
   * 화면에서 다 재생된 감정표현을 목록에서 지운다.
   * @param id
   */
  const removeEmote = (id: number): void => {
    setActiveEmotes((prev) => prev.filter((e) => e.id !== id));
  };

  return { state, error, toast, activeEmotes, removeEmote };
};
