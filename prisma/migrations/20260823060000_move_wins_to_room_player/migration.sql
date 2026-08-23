-- 승수를 계정(Player) 단위에서 방 참가자(RoomPlayer) 단위로 옮긴다.
-- 방을 옮기면 승수도 새로 시작해야 하기 때문이다. 기존 값은 모두 0이라 옮길 게 없다.
ALTER TABLE "Player" DROP COLUMN "wins";
ALTER TABLE "RoomPlayer" ADD COLUMN "wins" INTEGER NOT NULL DEFAULT 0;
