import { getOrCreateGuestId } from "@/lib/guest";
import { prisma } from "@/lib/prisma";
import { RoomClient } from "./RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const guestId = await getOrCreateGuestId();
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const room = await prisma.room.findUnique({
    where: { code: upperCode },
    select: { name: true },
  });

  return (
    <RoomClient
      code={upperCode}
      roomName={room?.name ?? ""}
      userId={guestId}
    />
  );
}
