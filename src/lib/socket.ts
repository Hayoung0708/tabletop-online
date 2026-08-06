"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: "/socket.io" });
  }
  return socket;
}

// The socket is a singleton reused across navigations, so leaving a room
// (route change, back button, exit button) never disconnects it on its own —
// the server only learns a player left once the socket actually disconnects.
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
