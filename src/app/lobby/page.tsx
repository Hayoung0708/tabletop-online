import type { JSX } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { LobbyClient } from "@/app/lobby/LobbyClient";

/**
 * 로비 라우트. 공통 헤더와 로비 화면을 배치한다.
 * @returns 로비 페이지 엘리먼트
 */
const LobbyPage = (): JSX.Element => {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 py-8">
        <LobbyClient />
      </main>
    </>
  );
};

export default LobbyPage;
