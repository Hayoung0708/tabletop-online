"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { YAHTZEE_SOUND_SRC } from "@/constants/media";
import { playSound } from "@/utils/sound";
import type { PublicRoomState } from "@/server/roomManager";

export interface UseHulaAnnouncementsParams {
  players: PublicRoomState["players"];
  showAnnounce: (text: string) => void;
  /** 훌라(등록 없이 한 차례에 손패를 다 털기)가 나왔을 때 띄울 축하 연출. */
  onHula: () => void;
}

/**
 * 땡큐·스톱·훌라를 모두에게 알린다. 소켓 구독은 한 번만 붙이고, 안에서 볼
 * 최신 값들(참가자 목록, 콜백)은 ref로 넘겨받는다 — 매 렌더마다 구독을 다시
 * 붙이면 그사이 도착한 이벤트를 놓칠 수 있다.
 * @param params - 참가자 목록과 콜백
 * @param params.players
 * @param params.showAnnounce
 * @param params.onHula
 */
export const useHulaAnnouncements = ({
  players,
  showAnnounce,
  onHula,
}: UseHulaAnnouncementsParams): void => {
  const playersRef = useRef(players);
  const onHulaRef = useRef(onHula);
  useEffect(() => {
    playersRef.current = players;
    onHulaRef.current = onHula;
  }, [players, onHula]);

  useEffect(() => {
    const socket = getSocket();
    /**
     * 닉네임을 찾는다.
     * @param userId - 찾을 게스트 id
     * @returns 닉네임, 없으면 "-"
     */
    const nicknameOf = (userId: string): string =>
      playersRef.current.find((p) => p.userId === userId)?.nickname ?? "-";

    /**
     * 누군가 더미를 가져갔다(땡큐).
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 땡큐한 플레이어
     */
    const onThankYou = ({ playerId }: { playerId: string }): void => {
      showAnnounce(`${nicknameOf(playerId)} 땡큐!`);
    };
    /**
     * 누군가 스톱을 불렀다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 스톱을 부른 플레이어
     * @param root0.points - 그 사람의 손패 점수
     */
    const onStop = ({ playerId, points }: { playerId: string; points: number }): void => {
      showAnnounce(`${nicknameOf(playerId)}가 ${points}(으)로 스톱!`);
    };
    /** 훌라 — 야찌와 같은 축하 연출과 소리. */
    const onHulaEvent = (): void => {
      onHulaRef.current();
      playSound(YAHTZEE_SOUND_SRC);
    };

    socket.on("hula_thankyou", onThankYou);
    socket.on("hula_stop", onStop);
    socket.on("hula_hula", onHulaEvent);
    return (): void => {
      socket.off("hula_thankyou", onThankYou);
      socket.off("hula_stop", onStop);
      socket.off("hula_hula", onHulaEvent);
    };
  }, [showAnnounce]);
};
