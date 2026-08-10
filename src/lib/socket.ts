"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** 미들웨어 거절 뒤 다시 연결을 시도하기까지 기다리는 시간(ms). */
const RECONNECT_DELAY_MS = 1000;

/**
 * 싱글턴 소켓 인스턴스를 반환한다. 없으면 새로 연결한다.
 * @returns 소켓 인스턴스
 */
export const getSocket = (): Socket => {
  if (!socket) {
    const created = io({ path: "/socket.io" });
    socket = created;
    // 서버 인증 미들웨어가 거절하면(닉네임을 아직 안 정한 첫 방문 등)
    // socket.io는 자동 재연결을 하지 않는다 — 닉네임 입력 뒤에도 죽은
    // 소켓이 남아 방에 영영 연결되지 않으므로, 잠시 뒤 직접 다시 붙는다.
    /** 미들웨어 거절로 끊긴 소켓을 잠시 뒤 다시 연결한다. */
    const retryConnect = (): void => {
      setTimeout(() => {
        if (socket === created && !created.connected) created.connect();
      }, RECONNECT_DELAY_MS);
    };
    created.on("connect_error", retryConnect);
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
