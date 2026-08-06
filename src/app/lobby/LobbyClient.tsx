"use client";

import { useRef, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { CreateRoomCard } from "@/components/lobby/CreateRoomCard";
import { JoinByCodeCard } from "@/components/lobby/JoinByCodeCard";
import { PublicRoomList } from "@/components/lobby/PublicRoomList";
import { CreateRoomDialog } from "@/components/lobby/CreateRoomDialog";
import { useRoomList } from "@/hooks/useRoomList";
import { useCreateRoomForm } from "@/hooks/useCreateRoomForm";

/**
 * 로비 화면: 새 방 만들기, 코드로 참가하기, 공개 방 목록을 한 화면에 모은다.
 * @returns 로비 엘리먼트
 */
export const LobbyClient = (): JSX.Element => {
  const router = useRouter();
  const rooms = useRoomList();
  const form = useCreateRoomForm();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [joinCode, setJoinCode] = useState("");

  /**
   * 해당 코드의 방으로 이동한다.
   * @param code
   */
  const handleJoin = (code: string): void => {
    router.push(`/room/${code.toUpperCase()}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <CreateRoomCard onOpenDialog={() => dialogRef.current?.showModal()} />
      <JoinByCodeCard
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        onJoin={handleJoin}
      />

      {form.error && <p className="text-sm text-red-400">{form.error}</p>}

      <PublicRoomList rooms={rooms} onJoin={handleJoin} />

      <CreateRoomDialog
        dialogRef={dialogRef}
        form={form}
        onRequestClose={() => dialogRef.current?.close()}
      />
    </div>
  );
};
