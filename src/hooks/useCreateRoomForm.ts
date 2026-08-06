"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/utils/roomApi";

const DEFAULT_MAX_PLAYERS = 6;

export interface UseCreateRoomFormResult {
  gameType: string;
  setGameType: (value: string) => void;
  roomName: string;
  setRoomName: (value: string) => void;
  isPrivate: boolean;
  setIsPrivate: (value: boolean) => void;
  creating: boolean;
  error: string | null;
  clearError: () => void;
  submit: () => Promise<void>;
}

/**
 * "새 방 만들기" 다이얼로그의 입력 상태와 제출 로직을 관리한다. 성공하면
 * 방금 만든 방으로 이동시킨다.
 * @returns 폼 상태와 제출 함수
 */
export const useCreateRoomForm = (): UseCreateRoomFormResult => {
  const router = useRouter();
  const [gameType, setGameType] = useState("YATZY");
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 입력된 값으로 방 생성을 요청하고, 성공하면 그 방으로 이동한다. */
  const submit = async (): Promise<void> => {
    setCreating(true);
    setError(null);
    try {
      const result = await createRoom({
        gameType,
        name: roomName.trim(),
        isPrivate,
        maxPlayers: DEFAULT_MAX_PLAYERS,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/room/${result.code}`);
    } finally {
      setCreating(false);
    }
  };

  return {
    gameType,
    setGameType,
    roomName,
    setRoomName,
    isPrivate,
    setIsPrivate,
    creating,
    error,
    clearError: () => setError(null),
    submit,
  };
};
