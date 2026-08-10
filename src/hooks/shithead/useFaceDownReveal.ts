"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { Card } from "@/server/shithead/deck";

export interface FaceDownReveal {
  index: number;
  card: Card;
}

/**
 * 이 플레이어가 지금 뒤집고 있는 바닥패가 있는지 추적한다. 서버가
 * shithead_face_down_reveal을 보내면 그 카드를 기억해 두고, 실제 게임
 * 상태(faceDown)가 이 자리를 비웠다고 확인해줄 때까지 계속 들고 있는다 —
 * 소켓 이벤트만 보고 먼저 지우면, 실제 상태가 도착하기 전 옛 뒷면 카드가
 * 한 프레임 비치는 깜빡임이 생긴다. 뒤집는 애니메이션 자체는 FaceCardSlots가
 * 이 값을 받아 직접 재생한다.
 * @param userId - 추적할 플레이어의 게스트 id (없으면 구독하지 않음)
 * @param faceDown - 이 플레이어의 실제 바닥패 자리 상태 (렌더마다 최신값)
 * @returns 지금 뒤집는 중인 바닥패 정보, 없으면 null
 */
export const useFaceDownReveal = (
  userId: string | undefined,
  faceDown: boolean[],
): FaceDownReveal | null => {
  const [reveal, setReveal] = useState<FaceDownReveal | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();

    /**
     * 서버가 이 플레이어의 바닥패 뒤집기를 알려오면 그 카드를 기억해 둔다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 뒤집은 플레이어
     * @param root0.index - 뒤집은 바닥패 자리
     * @param root0.card - 뒤집힌 카드
     */
    const onReveal = ({
      playerId,
      index,
      card,
    }: {
      playerId: string;
      index: number;
      card: Card;
    }): void => {
      if (playerId !== userId) return;
      setReveal({ index, card });
    };

    socket.on("shithead_face_down_reveal", onReveal);
    return (): void => {
      socket.off("shithead_face_down_reveal", onReveal);
    };
  }, [userId]);

  // 실제 상태가 이 자리를 비웠다고 확정하면(더미로 나갔거나 손패로 옮겨감)
  // 그 즉시(렌더 중에) 반환값을 비운다 — 이펙트로 한 박자 늦게 지우면
  // 그 사이 실제 상태와 어긋난 옛 뒷면 카드가 한 프레임 비칠 수 있다.
  if (reveal && faceDown[reveal.index] === false) return null;
  return reveal;
};
