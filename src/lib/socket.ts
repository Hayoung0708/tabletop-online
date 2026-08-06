"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * 싱글턴 소켓 인스턴스를 반환한다. 없으면 새로 연결한다.
 * @returns 소켓 인스턴스
 */
export const getSocket = (): Socket => {
  if (!socket) {
    socket = io({ path: "/socket.io" });
  }
  return socket;
};

/**
 * 소켓을 끊고 싱글턴을 비운다.
 *
 * 소켓은 페이지 이동에도 유지되는 싱글턴이라, 방을 나갈 때(라우트 변경,
 * 뒤로가기, 나가기 버튼) 직접 끊어주지 않으면 서버가 이탈을 감지하지 못한다.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
