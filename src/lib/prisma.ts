import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

interface GlobalWithPrisma {
  prisma: PrismaClient | undefined;
}

// 개발 모드에서 tsx watch가 파일을 바꿀 때마다 서버를 재시작하는데, 그때마다
// 새 PrismaClient를 만들면 커넥션이 계속 쌓여서 globalThis에 캐시해 재사용한다.
const globalForPrisma = globalThis as unknown as GlobalWithPrisma;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
