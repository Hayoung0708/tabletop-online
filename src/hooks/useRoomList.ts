"use client";

import { useEffect, useState } from "react";
import { fetchRoomList, type RoomSummary } from "@/utils/roomApi";

const POLL_INTERVAL_MS = 4000;

/**
 * 공개 방 목록을 주기적으로 다시 불러온다.
 * @returns 최신 공개 방 목록
 */
export const useRoomList = (): RoomSummary[] => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    /** 방 목록을 다시 불러와 상태를 갱신한다. */
    const load = (): void => {
      fetchRoomList().then((list) => {
        if (!cancelled && list) setRooms(list);
      });
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return (): void => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return rooms;
};
