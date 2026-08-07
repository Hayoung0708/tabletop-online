"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { EMOTES } from "@/constants/media";
import { clearRoomJoined } from "@/utils/roomJoinStorage";

export interface UseRoomActionsResult {
  startGame: () => void;
  sendEmote: (emoteId: string) => void;
  /** 감정표현별 쿨타임 진행 여부. true인 동안 버튼을 비활성화한다. */
  emoteOnCooldown: Record<string, boolean>;
  leaveRoom: () => void;
}

/**
 * 게임 종류와 상관없이 방 안에서 공통으로 쓰는 소켓 액션들을 모아 둔다.
 * @param code - 방 코드 (나가기 시 로컬 참가 기록을 지우는 데 사용)
 * @returns 방에서 쓸 수 있는 공통 액션 함수 모음
 */
export const useRoomActions = (code: string): UseRoomActionsResult => {
  const router = useRouter();
  const [emoteOnCooldown, setEmoteOnCooldown] = useState<Record<string, boolean>>({});

  /** 게임을 시작한다 (방장만 가능). */
  const startGame = (): void => {
    getSocket().emit("start_game");
  };

  /**
   * 감정표현을 보낸다. 쿨타임이 걸려 있는 종류는 그 안에 다시 누르면 무시한다.
   * @param emoteId - 보낼 감정표현 종류
   */
  const sendEmote = (emoteId: string): void => {
    if (emoteOnCooldown[emoteId]) return;

    const cooldownMs = EMOTES.find((e) => e.id === emoteId)?.cooldownMs ?? 0;
    if (cooldownMs > 0) {
      setEmoteOnCooldown((prev) => ({ ...prev, [emoteId]: true }));
      setTimeout(() => {
        setEmoteOnCooldown((prev) => ({ ...prev, [emoteId]: false }));
      }, cooldownMs);
    }
    getSocket().emit("emote", { emoteId });
  };

  /** 방을 나가고 로비로 이동한다. */
  const leaveRoom = (): void => {
    // 참가 기록도 같이 지운다 — 실제로 서버에서도 제거되므로, 다시 들어오면
    // 조용히 재입장을 시도하지 않고 닉네임 폼부터 다시 보여줘야 한다.
    clearRoomJoined(code);
    getSocket().emit("leave_room");
    router.push("/lobby");
  };

  return { startGame, sendEmote, emoteOnCooldown, leaveRoom };
};
