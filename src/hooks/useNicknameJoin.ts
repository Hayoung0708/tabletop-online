"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearRoomJoined,
  hasJoinedRoomBefore,
  isPageReload,
  markRoomJoined,
  readSavedNickname,
} from "@/utils/roomJoinStorage";

export interface UseNicknameJoinResult {
  nickname: string;
  setNickname: (value: string) => void;
  joined: boolean;
  joining: boolean;
  joinError: string | null;
  joinRoom: (nicknameToUse: string) => Promise<void>;
}

/**
 * 닉네임 입력 폼 상태와 방 참가 API 호출을 관리한다. 방에 있던 중 새로고침한
 * 경우에만 저장된 닉네임으로 자동 재입장하고, 그 외에는 닉네임 폼을 보여준다.
 * @param code - 방 코드
 * @returns 닉네임 폼 상태와 참가 함수
 */
export const useNicknameJoin = (code: string): UseNicknameJoinResult => {
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  /**
   * 주어진 닉네임으로 방 참가 API를 호출한다.
   * @param nicknameToUse
   */
  const joinRoom = async (nicknameToUse: string): Promise<void> => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nicknameToUse }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        // 방이 아예 사라졌을 수도 있으니 표시를 지워서, 재시도/새로고침이
        // 실패한 방을 다시 자동 참가하려 들지 않고 닉네임 폼으로 돌아가게 한다.
        clearRoomJoined(code);
        setJoinError(data?.error ?? "참가할 수 없습니다.");
        return;
      }
      markRoomJoined(code, nicknameToUse);
      setJoined(true);
    } catch {
      setJoinError("참가할 수 없습니다. 다시 시도해주세요.");
    } finally {
      setJoining(false);
    }
  };

  // 자동 재입장은 "이 방에 참가한 채로 새로고침한 경우"에만 한다. 로비에서
  // 다시 들어오거나 뒤로가기로 돌아온 경우에는 닉네임을 다시 정할 수 있어야
  // 하므로 저장된 닉네임을 폼에 채워만 두고 참가는 하지 않는다.
  const autoJoinDone = useRef(false);
  useEffect(() => {
    const saved = readSavedNickname();
    if (!saved || autoJoinDone.current) return;
    autoJoinDone.current = true;

    const rejoin = hasJoinedRoomBefore(code) && isPageReload();
    Promise.resolve().then(() => {
      setNickname(saved);
      if (rejoin) void joinRoom(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return { nickname, setNickname, joined, joining, joinError, joinRoom };
};
