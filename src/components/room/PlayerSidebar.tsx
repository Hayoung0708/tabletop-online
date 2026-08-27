"use client";

import type { JSX } from "react";
import { CrownIcon, DisconnectedIcon } from "@/components/icons/RoomIcons";
import { EMOTE_SLOT_SIZE_REM, EMOTES } from "@/constants/media";
import { EmoteButton } from "@/components/room/EmoteButton";
import { EmotePlayer } from "@/components/room/EmotePlayer";
import type { ActiveEmote } from "@/hooks/useRoomSocket";
import type { PublicRoomState } from "@/server/roomManager";

export interface PlayerSidebarProps {
  players: PublicRoomState["players"];
  currentPlayerId: string | null;
  hostId: string;
  /** 각 플레이어 이름 아래에 보여줄 추가 정보 (점수, 남은 카드 수 등). 없으면 안 보여줌. */
  extraLine?: (userId: string) => string | null;
  onSendEmote: (emoteId: string) => void;
  /** 감정표현별 쿨타임 진행 여부 — true인 동안 버튼을 비활성화한다. */
  emoteOnCooldown: Record<string, boolean>;
  activeEmotes: ActiveEmote[];
  onRemoveEmote: (id: number) => void;
}

const slotStyle = {
  width: `${EMOTE_SLOT_SIZE_REM}rem`,
  height: `${EMOTE_SLOT_SIZE_REM}rem`,
};

/**
 * 감정표현별 재생 크기/위치를 계산한다. 슬롯(카드 레이아웃)에는 영향 없이
 * 시각적으로만 배율만큼 커지고, 슬롯 중심에서 세로로만 오프셋만큼 밀린다.
 * 카드 밖으로 나가는 부분은 카드의 overflow-hidden에 의해 잘린다.
 * @param displayScale - 슬롯 대비 배율 (기본 1배)
 * @param offsetYPx - 슬롯 중심 기준 세로 오프셋(px, 기본 0)
 * @returns width/height/transform 인라인 스타일
 */
const getDisplayStyle = (
  displayScale = 1,
  offsetYPx = 0,
): { width: string; height: string; transform: string } => {
  const sizeRem = EMOTE_SLOT_SIZE_REM * displayScale;
  return {
    width: `${sizeRem}rem`,
    height: `${sizeRem}rem`,
    transform: `translate(-50%, calc(-50% + ${offsetYPx}px))`,
  };
};

/**
 * 왼쪽에 고정된 참가자 목록 + 감정표현 버튼. 각 참가자 카드 오른쪽에는
 * 감정표현용 정사각형 슬롯 자리를 항상 고정 크기로 남겨 두어 카드 레이아웃이
 * 흔들리지 않게 하고, 실제 재생은 감정표현별 배율(displayScale)만큼 가운데
 * 겹쳐서 보여준다 (카드 레이아웃에는 영향을 주지 않고 시각적으로만 커진다).
 * @param props - 참가자 정보와 감정표현 전송/전달 핸들러
 * @param props.players
 * @param props.currentPlayerId
 * @param props.hostId
 * @param props.extraLine
 * @param props.onSendEmote
 * @param props.emoteOnCooldown
 * @param props.activeEmotes
 * @param props.onRemoveEmote
 * @returns 사이드바 엘리먼트
 */
export const PlayerSidebar = ({
  players,
  currentPlayerId,
  hostId,
  extraLine,
  onSendEmote,
  emoteOnCooldown,
  activeEmotes,
  onRemoveEmote,
}: PlayerSidebarProps): JSX.Element => {
  return (
    // 모바일(세로 화면)에서는 옆에 둘 자리가 없어 위쪽 가로 줄로 눕힌다.
    // 참가자 카드가 가로로 늘어서고, 감정표현은 그 오른쪽 끝에 붙는다.
    <aside className="flex w-full shrink-0 gap-2 overflow-x-auto border-b border-slate-800 px-3 py-2 lg:w-72 lg:flex-col lg:gap-3 lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-4 lg:py-4">
      {players.map((p) => {
        const extra = extraLine?.(p.userId) ?? null;
        const activeEmote = activeEmotes.find((e) => e.userId === p.userId) ?? null;
        const activeEmoteDef = activeEmote
          ? EMOTES.find((e) => e.id === activeEmote.emoteId)
          : undefined;
        return (
          <div
            key={p.userId}
            // 좁은 화면(가로 줄)에서는 폭을 고정한다 — 방장 왕관 유무에 따라 카드
            // 폭이 들쭉날쭉하면 줄이 지저분해진다.
            className={`flex w-48 shrink-0 items-center justify-between gap-2 overflow-hidden rounded-lg border px-3 py-2 text-sm transition sm:px-4 sm:py-3 sm:text-base lg:w-auto ${
              p.userId === currentPlayerId
                ? "border-indigo-500 bg-indigo-600"
                : "border-slate-800 bg-slate-900/60"
            } ${p.connected ? "" : "opacity-40"}`}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {p.userId === hostId && (
                  <CrownIcon className="h-4 w-4 shrink-0 text-yellow-300" />
                )}
                <span className="truncate font-medium">{p.nickname}</span>
                {!p.connected && (
                  <DisconnectedIcon className="h-4 w-4 shrink-0 text-red-300" />
                )}
              </div>
              {/* 게임 중에는 손패 장수 같은 진행 정보가, 대기 중에는 승수만 보인다. */}
              <span className="flex items-center gap-2">
                {extra && <span className="text-slate-200">{extra}</span>}
                <span className="text-sm text-slate-400">{p.wins}승</span>
              </span>
            </div>

            <div className="relative shrink-0" style={slotStyle}>
              {activeEmote && (
                <div
                  className="pointer-events-none absolute top-1/2 left-1/2 z-10"
                  style={getDisplayStyle(
                    activeEmoteDef?.displayScale,
                    activeEmoteDef?.offsetYPx,
                  )}
                >
                  <EmotePlayer
                    key={activeEmote.id}
                    emote={activeEmote}
                    onRemove={() => onRemoveEmote(activeEmote.id)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* 좁은 화면에서는 감정표현을 오른쪽 아래 플로팅 버튼(EmoteFab)이 맡는다 —
          가로 줄에 같이 넣으면 참가자 카드가 밀려 스크롤이 길어진다. */}
      <div className="hidden shrink-0 flex-col gap-1 lg:mt-auto lg:flex">
        <span className="hidden text-base font-medium text-slate-400 lg:block">
          감정표현
        </span>
        <div className="flex min-h-0 flex-1 gap-1.5 lg:flex-none lg:flex-col">
          <div className="flex h-full gap-1.5">
            {EMOTES.slice(0, 1).map((emote) => (
              <EmoteButton
                key={emote.id}
                emote={emote}
                onCooldown={emoteOnCooldown[emote.id] ?? false}
                onClick={() => onSendEmote(emote.id)}
                iconClassName="h-9 w-9"
                className="aspect-square h-full w-auto text-2xl lg:aspect-auto lg:h-auto lg:w-auto lg:flex-1 lg:py-2"
              />
            ))}
          </div>
          <div className="flex h-full gap-1.5">
            {EMOTES.slice(1).map((emote) => (
              <EmoteButton
                key={emote.id}
                emote={emote}
                onCooldown={emoteOnCooldown[emote.id] ?? false}
                onClick={() => onSendEmote(emote.id)}
                iconClassName="h-[4.5rem] w-[4.5rem]"
                className="aspect-square h-full w-auto text-3xl lg:aspect-auto lg:h-auto lg:w-auto lg:flex-1 lg:py-4"
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
