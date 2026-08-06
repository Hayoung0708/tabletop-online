"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface RoomSummary {
  code: string;
  name: string;
  gameType: string;
  maxPlayers: number;
  playerCount: number;
  nicknames: (string | null)[];
  createdAt: string;
}

const GAMES = [
  { id: "YATZY", label: "야찌", desc: "주사위 5개, 13턴 점수 대결", icon: "🎲" },
] as const;

async function fetchRoomList(): Promise<RoomSummary[] | null> {
  const res = await fetch("/api/rooms");
  if (!res.ok) return null;
  const data = await res.json();
  return data.rooms as RoomSummary[];
}

export function LobbyClient() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [gameType, setGameType] = useState<string>("YATZY");
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetchRoomList().then((list) => {
        if (!cancelled && list) setRooms(list);
      });
    }

    load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType,
          name: roomName.trim(),
          isPrivate,
          maxPlayers: 6,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "방을 만들 수 없습니다.");
        return;
      }
      router.push(`/room/${data.code}`);
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(code: string) {
    router.push(`/room/${code.toUpperCase()}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-5">
        <h2 className="text-lg font-semibold">새 방 만들기</h2>
        <button
          onClick={() => dialogRef.current?.showModal()}
          className="self-start rounded-lg bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500 transition"
        >
          방 만들기
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-5">
        <h2 className="text-lg font-semibold">코드로 참가하기</h2>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="방 코드 입력"
            maxLength={6}
            className="flex-1 rounded-lg bg-slate-800 px-4 py-2.5 outline-none ring-1 ring-slate-700 focus:ring-indigo-500 tracking-widest uppercase"
          />
          <button
            onClick={() => joinCode && handleJoin(joinCode)}
            disabled={joinCode.length < 4}
            className="rounded-lg bg-slate-700 px-4 py-2.5 font-medium hover:bg-slate-600 transition disabled:opacity-50"
          >
            참가
          </button>
        </div>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">공개 방</h2>
        {rooms.length === 0 && (
          <p className="text-sm text-slate-500">공개된 방이 없습니다.</p>
        )}
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => (
            <li
              key={room.code}
              className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{room.name}</span>
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-normal text-slate-400">
                    {GAMES.find((g) => g.id === room.gameType)?.label ??
                      room.gameType}
                  </span>
                </p>
                <p className="truncate text-sm text-slate-400">
                  {room.playerCount}/{room.maxPlayers}명 ·{" "}
                  {room.nicknames.filter(Boolean).join(", ")}
                </p>
              </div>
              <button
                onClick={() => handleJoin(room.code)}
                disabled={room.playerCount >= room.maxPlayers}
                className="ml-3 shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-40"
              >
                참가
              </button>
            </li>
          ))}
        </ul>
      </section>

      <dialog
        ref={dialogRef}
        onClose={() => setError(null)}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-black/60"
      >
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex flex-col gap-5"
        >
          <h2 className="text-2xl font-bold">새 방 만들기</h2>

          <div className="flex flex-col gap-2">
            <span className="text-base font-medium text-slate-300">게임 선택</span>
            <div className="grid grid-cols-2 gap-2">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGameType(g.id)}
                  aria-pressed={gameType === g.id}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-5 transition ${
                    gameType === g.id
                      ? "border-indigo-500 bg-indigo-950"
                      : "border-slate-700 bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <span className="text-3xl">{g.icon}</span>
                  <span className="text-lg font-semibold">{g.label}</span>
                  <span className="text-center text-sm text-slate-400">
                    {g.desc}
                  </span>
                </button>
              ))}
              <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-800 px-4 py-5 text-slate-600">
                <span className="text-3xl">➕</span>
                <span className="text-sm">추가 예정</span>
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-base font-medium text-slate-300">방 이름</span>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="야찌 한 판"
              maxLength={20}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-base outline-none ring-1 ring-slate-700 focus:ring-indigo-500"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-3">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-500"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-medium">비밀방</span>
              <span className="text-sm text-slate-400">
                공개 방 목록에 나타나지 않고, 방 코드로만 입장할 수 있습니다.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-base font-medium hover:bg-slate-800 transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-base font-medium hover:bg-indigo-500 transition disabled:opacity-50"
            >
              만들기
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
