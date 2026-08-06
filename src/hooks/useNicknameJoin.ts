"use client";

import { useEffect, useState } from "react";
import {
  clearRoomJoined,
  hasJoinedRoomBefore,
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
 * 닉네임 입력 폼 상태와 방 참가 API 호출을 관리한다. 새로고침 등으로 이미
 * 참가한 적 있는 방이면 저장된 닉네임으로 자동 재입장을 시도한다.
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

  // 이 방에 실제로 참가한 적이 있을 때만(새로고침) 자동 재입장한다 — 저장된
  // 닉네임만으로는 이 브라우저가 예전에 플레이했다는 뜻일 뿐, 방금 만든
  // 새 방까지 폼을 건너뛰고 들어가야 한다는 뜻은 아니다.
  useEffect(() => {
    const saved = readSavedNickname();
    if (!saved) return;

    const alreadyJoined = hasJoinedRoomBefore(code);
    Promise.resolve().then(() => {
      setNickname(saved);
      if (alreadyJoined) void joinRoom(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return { nickname, setNickname, joined, joining, joinError, joinRoom };
};
