"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { disconnectSocket, getSocket } from "@/lib/socket";
import {
  CATEGORIES,
  calculateScore,
  upperBonus,
  upperTotal,
  type Category,
} from "@/lib/yatzy";
import type { PublicRoomState } from "@/server/roomManager";
import { Die } from "@/components/Die";
import { SiteHeader } from "@/components/SiteHeader";
import { Toast, useToast } from "@/components/Toast";

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2.5 18.5h19l1-9-5.5 3.2L12 5l-5 7.7-5.5-3.2z" />
    </svg>
  );
}

function DisconnectedIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
    </svg>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 cursor-help text-slate-500 hover:text-slate-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="10.5" x2="12" y2="16" />
        <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-relaxed font-normal whitespace-pre-line text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

// Pinned to the actual viewport edge (not the centered content column) at a
// standard IAB "Wide Skyscraper" size, so it reads as a real ad rail instead
// of a box floating next to the game.
function AdRail({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`pointer-events-none fixed top-1/2 z-0 hidden -translate-y-1/2 xl:block ${
        side === "left" ? "left-6" : "right-6"
      }`}
    >
      <div className="pointer-events-auto flex h-[600px] w-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-800 text-xs text-slate-600">
        <span>광고</span>
        <span>160×600</span>
      </div>
    </div>
  );
}

const YAHTZEE_ANIMATION = "/lottie/yahtzee-success.json";
const YAHTZEE_SOUND = "/sounds/yahtzee-success.mp3";

// Plays once, fullscreen-centered, then reports itself done so the caller
// can drop it from the active list. lottie-web touches the DOM, so it's
// imported lazily inside the effect instead of at module scope.
function YahtzeeCelebration({ onDone }: { onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let anim: any = null;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: YAHTZEE_ANIMATION,
      });
      anim.addEventListener("complete", onDone);
    });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
    />
  );
}

const CATEGORY_LABELS: Record<Category, string> = {
  ones: "1",
  twos: "2",
  threes: "3",
  fours: "4",
  fives: "5",
  sixes: "6",
  threeKind: "트리플",
  fourKind: "포카드",
  fullHouse: "풀하우스",
  smallStraight: "스몰 스트레이트",
  largeStraight: "라지 스트레이트",
  yahtzee: "야찌",
  chance: "찬스",
};

const UPPER_CATEGORIES = CATEGORIES.slice(0, 6);
const LOWER_CATEGORIES = CATEGORIES.slice(6);

// Every score cell renders at this exact size — filled, clickable, or empty —
// so the table never grows or shrinks when it becomes your turn.
const CELL_BASE =
  "inline-flex min-w-14 justify-center rounded-md border px-2.5 py-1 text-base font-semibold leading-snug";

const NICKNAME_STORAGE_KEY = "yatzy_nickname";
const joinedRoomKey = (code: string) => `yatzy_joined_${code}`;
const EMPTY_MASK = [false, false, false, false, false];
// Roughly matches the length of the dice-roll clips so the tumbling
// animation and the rolling sound finish together.
const ROLL_ANIMATION_MS = 700;

const DICE_SOUND_COUNT = 13;
const DICE_SOUND_POOL = Array.from(
  { length: DICE_SOUND_COUNT },
  (_, i) => `/sounds/dice-rolls/dice-${String(i + 1).padStart(2, "0")}.mp3`
);

// Only one emote exists for now; swap to a pool + random pick once more are added.
const EMOTE_VIDEO = "/emotes/emote-01.webm";
const EMOTE_AUDIO = "/emotes/emote-01.m4a";

interface ActiveEmote {
  id: number;
  x: number;
  y: number;
}

let emoteIdSeq = 0;
let celebrationIdSeq = 0;

function pickRandomSounds(count: number): string[] {
  const indices = Array.from({ length: DICE_SOUND_COUNT }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices
    .slice(0, Math.min(count, DICE_SOUND_COUNT))
    .map((i) => DICE_SOUND_POOL[i]);
}

export function RoomClient({
  code,
  roomName,
  userId,
}: {
  code: string;
  roomName: string;
  userId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const [copied, setCopied] = useState(false);

  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [activeEmotes, setActiveEmotes] = useState<ActiveEmote[]>([]);
  const [celebrations, setCelebrations] = useState<{ id: number }[]>([]);
  const [rollingMask, setRollingMask] = useState<boolean[]>(EMPTY_MASK);
  const [randomFaces, setRandomFaces] = useState<number[]>([1, 1, 1, 1, 1]);
  const prevRollsLeftRef = useRef<number | null>(null);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);
  // Last state seen by the socket handler. Compared there rather than in an
  // effect so React's double-invoked dev effects can't clobber the baseline.
  const lastStateRef = useRef<PublicRoomState | null>(null);

  function playRollSound(diceCount: number) {
    for (const src of pickRandomSounds(diceCount)) {
      new Audio(src).play().catch(() => {});
    }
  }

  async function joinRoom(nicknameToUse: string) {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nicknameToUse }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        // The room may be gone entirely; drop the marker so a retry or reload
        // falls back to the plain form instead of looping on a doomed join.
        window.localStorage.removeItem(joinedRoomKey(code));
        setJoinError(data?.error ?? "참가할 수 없습니다.");
        return;
      }
      window.localStorage.setItem(NICKNAME_STORAGE_KEY, nicknameToUse);
      window.localStorage.setItem(joinedRoomKey(code), "1");
      setJoined(true);
    } catch {
      setJoinError("참가할 수 없습니다. 다시 시도해주세요.");
    } finally {
      setJoining(false);
    }
  }

  // Only auto-rejoin if we've actually joined THIS room before (a refresh) —
  // a saved nickname alone just means this browser has played before, not
  // that this brand-new room should be entered without ever seeing the form.
  useEffect(() => {
    const saved = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (!saved) return;

    const alreadyJoined = window.localStorage.getItem(joinedRoomKey(code)) === "1";
    Promise.resolve().then(() => {
      setNickname(saved);
      if (alreadyJoined) joinRoom(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The socket is a singleton, so navigating away from this room (button,
  // back button, header logo) must disconnect it directly — otherwise the
  // server never sees this player leave and others don't get notified.
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard blocked — ignore, code is already visible to copy by hand.
    }
  }

  useEffect(() => {
    if (!joined) return;

    const socket = getSocket();

    function join() {
      socket.emit("join_room", { code });
    }

    function onRoomState(next: PublicRoomState) {
      const prev = lastStateRef.current;
      lastStateRef.current = next;

      if (prev?.status === "PLAYING") {
        const left = prev.players.filter((p) => {
          if (!p.connected || p.userId === userId) return false;
          const now = next.players.find((x) => x.userId === p.userId);
          return !now || !now.connected;
        });
        if (left.length > 0) {
          setToast({
            text:
              left.length === 1
                ? `${left[0].nickname}님이 게임을 나갔습니다.`
                : `${left[0].nickname}님 외 ${left.length - 1}명이 게임을 나갔습니다.`,
          });
        }
      }

      setState(next);
      setError(null);
    }

    function onError(message: string) {
      setError(message);
    }

    function onEmote({ x, y }: { x: number; y: number }) {
      const id = ++emoteIdSeq;
      setActiveEmotes((prev) => [...prev, { id, x, y }]);
      new Audio(EMOTE_AUDIO).play().catch(() => {});
    }

    socket.on("connect", join);
    socket.on("room_state", onRoomState);
    socket.on("error_message", onError);
    socket.on("emote", onEmote);

    if (socket.connected) join();

    return () => {
      socket.off("connect", join);
      socket.off("room_state", onRoomState);
      socket.off("error_message", onError);
      socket.off("emote", onEmote);
    };
  }, [code, joined, userId, setToast]);

  // Tumble the dice (and play the roll sound) only on a real roll — never
  // when the game merely transitions into PLAYING.
  useEffect(() => {
    if (!state) return;

    const rolled =
      prevRollsLeftRef.current !== null &&
      state.rollsLeft < prevRollsLeftRef.current;

    prevRollsLeftRef.current = state.rollsLeft;
    if (!rolled) return;

    const isYahtzeeRoll = state.dice.every((d) => d === state.dice[0]);
    const mask = state.held.map((h) => !h);
    let cancelled = false;

    const interval = setInterval(() => {
      if (cancelled) return;
      setRandomFaces(
        mask.map((m) => (m ? 1 + Math.floor(Math.random() * 6) : 1))
      );
    }, 90);

    const timeout = setTimeout(() => {
      if (cancelled) return;
      clearInterval(interval);
      setRollingMask(EMPTY_MASK);
      if (isYahtzeeRoll) {
        setCelebrations((c) => [...c, { id: ++celebrationIdSeq }]);
        new Audio(YAHTZEE_SOUND).play().catch(() => {});
      }
    }, ROLL_ANIMATION_MS);

    const diceCount = mask.filter(Boolean).length;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setRollingMask(mask);
        playRollSound(diceCount);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // Only re-trigger when a roll actually happens — not on every
    // room_state broadcast (e.g. other players' hold toggles).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.rollsLeft]);

  const me = useMemo(
    () => state?.players.find((p) => p.userId === userId) ?? null,
    [state, userId]
  );
  const isHost = state?.hostId === userId;
  const isMyTurn = state?.currentPlayerId === userId;
  const hasRolled = (state?.rollsLeft ?? 3) < 3;
  const isRolling = rollingMask.some(Boolean);
  const activePlayers = state?.players.filter((p) => p.connected) ?? [];
  const showBoard = state?.status === "PLAYING" || state?.status === "FINISHED";

  function rollDice() {
    getSocket().emit("roll_dice");
  }

  function toggleHold(dieIndex: number) {
    getSocket().emit("toggle_hold", { dieIndex });
  }

  function scoreCategory(category: Category) {
    getSocket().emit("score_category", { category });
  }

  function startGame() {
    getSocket().emit("start_game");
  }

  function sendEmote() {
    const x = 10 + Math.random() * 75;
    const y = 10 + Math.random() * 75;
    getSocket().emit("emote", { x, y });
  }

  function removeEmote(id: number) {
    setActiveEmotes((prev) => prev.filter((e) => e.id !== id));
  }

  function removeCelebration(id: number) {
    setCelebrations((prev) => prev.filter((c) => c.id !== id));
  }

  function leaveRoom() {
    // Drop the "already joined" marker too — leaving really does remove us
    // server-side, so coming back must show the nickname form again rather
    // than silently re-firing a join at a room we're no longer part of.
    window.localStorage.removeItem(joinedRoomKey(code));
    getSocket().emit("leave_room");
    router.push("/lobby");
  }

  function handleExit() {
    if (state?.status === "PLAYING") {
      leaveDialogRef.current?.showModal();
      return;
    }
    leaveRoom();
  }

  const roomHeader = (
    <div className="flex items-center gap-3">
      <h1 className="truncate text-xl font-bold">{roomName}</h1>
      <button
        onClick={copyCode}
        title="클릭하면 방 코드가 복사됩니다"
        className="flex items-center gap-1.5 rounded font-mono text-sm tracking-widest text-slate-400 transition hover:text-slate-100"
      >
        {code}
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      </button>
    </div>
  );

  let body: ReactNode;
  let playersColumn: ReactNode = null;
  // Mirrors playersColumn's width on the other side so main stays centered
  // in the viewport instead of drifting right.
  let rightColumn: ReactNode = null;

  if (!joined) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nickname.trim().length >= 2) joinRoom(nickname.trim());
          }}
          className="flex w-full max-w-xs flex-col gap-3"
        >
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임 (2~16자)"
            maxLength={16}
            autoFocus
            className="rounded-lg bg-slate-800 px-4 py-3 outline-none ring-1 ring-slate-700 focus:ring-indigo-500"
          />
          {joinError && <p className="text-sm text-red-400">{joinError}</p>}
          <button
            type="submit"
            disabled={joining || nickname.trim().length < 2}
            className="rounded-lg bg-indigo-600 py-3 font-medium hover:bg-indigo-500 transition disabled:opacity-50"
          >
            {joining ? "입장하는 중..." : "이 닉네임으로 입장"}
          </button>
        </form>
      </div>
    );
  } else if (!state) {
    body = <p className="text-slate-400">방에 연결하는 중...</p>;
  } else {
    const currentState = state;
    playersColumn = (
      <aside className="hidden w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-800 px-4 py-4 sm:flex">
        {currentState.players.map((p) => (
          <div
            key={p.userId}
            className={`flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-base transition ${
              p.userId === currentState.currentPlayerId
                ? "border-indigo-500 bg-indigo-600"
                : "border-slate-800 bg-slate-900/60"
            } ${p.connected ? "" : "opacity-40"}`}
          >
            <div className="flex items-center gap-2">
              {p.userId === currentState.hostId && (
                <CrownIcon className="h-4 w-4 shrink-0 text-yellow-300" />
              )}
              <span className="truncate font-medium">{p.nickname}</span>
              {!p.connected && (
                <DisconnectedIcon className="h-4 w-4 shrink-0 text-red-300" />
              )}
            </div>
            {currentState.status !== "WAITING" && (
              <span className="text-slate-200">{p.total}점</span>
            )}
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-400">감정표현</span>
          <button
            onClick={sendEmote}
            title="감정표현"
            className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-2xl transition hover:bg-slate-800"
          >
            ❓
          </button>
        </div>
      </aside>
    );
    rightColumn = (
      <aside className="hidden w-52 shrink-0 border-l border-slate-800 px-4 py-4 sm:block" />
    );
    body = (
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-md bg-red-950 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {state.status === "WAITING" && (
          <div className="rounded-xl border border-slate-800 p-6 text-center">
            {state.winnerUserId && (
              <p className="mb-4 rounded-lg bg-indigo-950 px-4 py-2.5 text-sm text-indigo-200">
                🏆{" "}
                {state.players.find((p) => p.userId === state.winnerUserId)
                  ?.nickname ?? "-"}
                님 승리! 상대방이 나가서 게임이 종료되었습니다.
              </p>
            )}
            <p className="text-base text-slate-400">
              플레이어를 기다리는 중입니다 ({activePlayers.length}/
              {state.maxPlayers})
            </p>
            {isHost ? (
              <button
                onClick={startGame}
                disabled={activePlayers.length < 2}
                className="mt-5 rounded-lg bg-indigo-600 px-7 py-3 font-medium hover:bg-indigo-500 transition disabled:opacity-50"
              >
                게임 시작 {activePlayers.length < 2 && "(최소 2명)"}
              </button>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                방장이 게임을 시작하기를 기다리는 중...
              </p>
            )}
          </div>
        )}

        {state.status === "PLAYING" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <div className="flex gap-3 sm:gap-4">
              {state.dice.map((value, i) => (
                <Die
                  key={i}
                  value={rollingMask[i] ? randomFaces[i] : value}
                  held={state.held[i]}
                  rolling={rollingMask[i]}
                  onClick={() => isMyTurn && hasRolled && toggleHold(i)}
                  disabled={!isMyTurn || !hasRolled}
                />
              ))}
            </div>
            <button
              onClick={rollDice}
              disabled={!isMyTurn || state.rollsLeft <= 0 || isRolling}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-base font-medium hover:bg-indigo-500 transition disabled:opacity-40"
            >
              주사위 굴리기 ({state.rollsLeft}/3)
            </button>
          </div>
        )}

        {state.status === "FINISHED" && (
          <div className="rounded-xl border border-indigo-700 bg-indigo-950 px-6 py-4 text-center">
            <h2 className="text-xl font-bold">게임 종료!</h2>
            <ol className="mt-3 flex flex-col gap-1.5 text-base text-slate-200">
              {[...state.players]
                .sort((a, b) => b.total - a.total)
                .map((p, i) => (
                  <li key={p.userId}>
                    <span className="mr-1">
                      {i === 0 ? "🏆" : `${i + 1}위`}
                    </span>
                    {p.nickname} — <b>{p.total}점</b>
                  </li>
                ))}
            </ol>
            <button
              onClick={leaveRoom}
              className="mt-4 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium hover:bg-indigo-500 transition"
            >
              로비로 돌아가기
            </button>
          </div>
        )}

        {showBoard && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="bg-slate-900">
                  <th className="rounded-tl-xl py-1.5 pr-2 pl-4 text-left text-base font-bold text-slate-200">
                    항목
                  </th>
                  {activePlayers.map((p) => (
                    <th
                      key={p.userId}
                      className="px-2 py-1.5 text-center text-base font-bold text-slate-200 last:rounded-tr-xl"
                    >
                      {p.nickname}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {UPPER_CATEGORIES.map((cat, idx) => (
                  <ScoreRow
                    key={cat}
                    cat={cat}
                    idx={idx}
                    players={activePlayers}
                    dice={state.dice}
                    userId={userId}
                    isMyTurn={isMyTurn}
                    hasRolled={hasRolled && !isRolling}
                    onScore={scoreCategory}
                  />
                ))}
                <tr className="bg-slate-950/60 text-base">
                  <td className="py-1.5 pr-2 pl-4 text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      보너스
                      <InfoTooltip text={`상단(1~6) 항목 점수의 합이 63점 이상이면 보너스로 35점을 추가로 획득합니다.\n각 숫자를 3개씩만 모아도 63점이 되어 보너스 조건을 채울 수 있어요.`} />
                    </span>
                  </td>
                  {activePlayers.map((p) => {
                    const bonus = upperBonus(p.scorecard);
                    return (
                      <td
                        key={p.userId}
                        className="px-2 py-1.5 text-center text-slate-400"
                      >
                        {bonus > 0 ? (
                          <span className="text-emerald-400">{bonus}</span>
                        ) : (
                          `${upperTotal(p.scorecard)}/63`
                        )}
                      </td>
                    );
                  })}
                </tr>
                {LOWER_CATEGORIES.map((cat, idx) => (
                  <ScoreRow
                    key={cat}
                    cat={cat}
                    idx={idx}
                    players={activePlayers}
                    dice={state.dice}
                    userId={userId}
                    isMyTurn={isMyTurn}
                    hasRolled={hasRolled && !isRolling}
                    onScore={scoreCategory}
                  />
                ))}
                <tr className="border-t border-slate-800 bg-slate-900">
                  <td className="rounded-bl-xl py-2 pr-2 pl-4 text-base font-bold text-slate-100">
                    합계
                  </td>
                  {activePlayers.map((p) => (
                    <td
                      key={p.userId}
                      className="px-2 py-2 text-center text-base font-bold text-indigo-300 last:rounded-br-xl"
                    >
                      {p.total}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {me === null && (
          <p className="text-sm text-slate-500">
            이 방의 참가자가 아닙니다. 로비에서 참가해주세요.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <SiteHeader onExit={handleExit} />
      <AdRail side="left" />
      <AdRail side="right" />
      <div className="pointer-events-none fixed inset-0 z-40">
        {activeEmotes.map((e) => (
          <video
            key={e.id}
            src={EMOTE_VIDEO}
            autoPlay
            muted
            playsInline
            onEnded={() => removeEmote(e.id)}
            onError={() => removeEmote(e.id)}
            className="absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
          />
        ))}
        {celebrations.map((c) => (
          <YahtzeeCelebration key={c.id} onDone={() => removeCelebration(c.id)} />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
        {playersColumn}
        <main className="flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6">
          {roomHeader}
          {body}
        </main>
        {rightColumn}
      </div>

      {copied && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg"
        >
          복사되었습니다!
        </div>
      )}
      <Toast toast={toast} />

      <dialog
        ref={leaveDialogRef}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-black/60"
      >
        <h2 className="text-lg font-bold">정말 나가시겠습니까?</h2>
        <p className="mt-2 text-sm text-slate-400">
          게임이 진행 중입니다. 지금 나가면 패배로 처리되며, 이 게임에 다시
          참여할 수 없습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => leaveDialogRef.current?.close()}
            className="rounded-lg border border-slate-700 px-4 py-2 font-medium hover:bg-slate-800 transition"
          >
            계속하기
          </button>
          <button
            onClick={leaveRoom}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium hover:bg-red-500 transition"
          >
            나가기
          </button>
        </div>
      </dialog>
    </>
  );
}

function ScoreRow({
  cat,
  idx,
  players,
  dice,
  userId,
  isMyTurn,
  hasRolled,
  onScore,
}: {
  cat: Category;
  idx: number;
  players: PublicRoomState["players"];
  dice: number[];
  userId: string;
  isMyTurn: boolean;
  hasRolled: boolean;
  onScore: (cat: Category) => void;
}) {
  return (
    <tr className={idx % 2 === 0 ? "bg-transparent" : "bg-slate-950/30"}>
      <td className="py-1 pr-2 pl-4 text-slate-300">{CATEGORY_LABELS[cat]}</td>
      {players.map((p) => {
        const filled = p.scorecard[cat];
        const isOwnTurn = p.userId === userId && isMyTurn && hasRolled;
        // A repeat yahtzee can stack on top of an already-filled box.
        const stackable =
          cat === "yahtzee" &&
          filled !== null &&
          filled > 0 &&
          isOwnTurn &&
          dice.every((d) => d === dice[0]);
        const clickable = (isOwnTurn && filled === null) || stackable;
        const preview = clickable ? calculateScore(cat, dice) : null;

        return (
          <td key={p.userId} className="px-2 py-1 text-center">
            {clickable ? (
              <button
                onClick={() => onScore(cat)}
                className={`${CELL_BASE} border-dashed border-indigo-500/70 text-indigo-300 hover:bg-indigo-700 hover:text-white transition`}
              >
                {stackable ? (filled ?? 0) + (preview ?? 0) : preview}
              </button>
            ) : filled !== null ? (
              <span className={`${CELL_BASE} border-transparent bg-slate-800/80`}>
                {filled}
              </span>
            ) : (
              <span className={`${CELL_BASE} border-transparent text-slate-700`}>
                -
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
