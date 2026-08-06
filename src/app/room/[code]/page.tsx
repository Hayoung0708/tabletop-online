import type { JSX } from "react";
import { getOrCreateGuestId } from "@/server/guestAuth";
import { prisma } from "@/lib/prisma";
import { RoomClient } from "@/app/room/[code]/RoomClient";

export interface RoomPageProps {
  params: Promise<{ code: string }>;
}

/**
 * 방 라우트. 게스트 식별자를 확보하고 방 이름을 미리 조회해 RoomClient에 넘긴다.
 * @param props - 라우트 파라미터 (방 코드)
 * @param props.params
 * @returns 방 페이지 엘리먼트
 */
const RoomPage = async ({ params }: RoomPageProps): Promise<JSX.Element> => {
  const guestId = await getOrCreateGuestId();
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const room = await prisma.room.findUnique({
    where: { code: upperCode },
    select: { name: true },
  });

  return <RoomClient code={upperCode} roomName={room?.name ?? ""} userId={guestId} />;
};

export default RoomPage;
