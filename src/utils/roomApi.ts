export interface RoomSummary {
  code: string;
  name: string;
  gameType: string;
  maxPlayers: number;
  playerCount: number;
  nicknames: (string | null)[];
  createdAt: string;
}

export interface CreateRoomInput {
  gameType: string;
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
}

/**
 * 공개 방 목록을 가져온다.
 * @returns 방 목록, 요청이 실패하면 null
 */
export const fetchRoomList = async (): Promise<RoomSummary[] | null> => {
  const res = await fetch("/api/rooms");
  if (!res.ok) return null;
  const data = await res.json();
  return data.rooms as RoomSummary[];
};

/**
 * 새 방을 만든다.
 * @param input - 방 생성 옵션
 * @returns 성공 시 생성된 방 코드, 실패 시 에러 메시지
 */
export const createRoom = async (
  input: CreateRoomInput,
): Promise<{ code: string } | { error: string }> => {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error ?? "방을 만들 수 없습니다." };
  }
  return { code: data.code as string };
};
