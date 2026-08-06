import { SiteHeader } from "@/components/SiteHeader";
import { LobbyClient } from "./LobbyClient";

export default function LobbyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 py-8">
        <LobbyClient />
      </main>
    </>
  );
}
