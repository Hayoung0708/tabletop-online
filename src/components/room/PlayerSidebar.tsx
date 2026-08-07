"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { CrownIcon, DisconnectedIcon } from "@/components/icons/RoomIcons";
import { EMOTE_SLOT_SIZE_REM, EMOTES, type EmoteDef } from "@/constants/media";
import { EmotePlayer } from "@/components/room/EmotePlayer";
import type { ActiveEmote } from "@/hooks/useRoomSocket";
import type { PublicRoomState } from "@/server/roomManager";

const FLASH_DURATION_MS = 300;

export interface CooldownGaugeProps {
  cooldownMs: number;
  children: JSX.Element;
}

/**
 * 쿨타임이 걸린 동안에만 마운트되는, 배경+아이콘을 통째로 어둡게 필터
 * 걸어 복제한 막. 원본(버튼 배경 + 아이콘) 위에 그대로 겹쳐 놓고
 * clip-path로 아래쪽부터 걷어내서, 걷힌 자리에 아래 깔린 원래 밝은
 * 배경/아이콘이 바닥부터 차오르듯 드러나게 한다 (반투명 색을 덮는
 * 방식은 이미지 위에서 뿌옇게 떠 보여서 안 씀 — filter로 통째로
 * 어둡게 한 복제본을 clip으로 걷어내는 방식을 쓴다). 다 찼는지는
 * 부모가 onCooldown이 꺼지는 시점으로 직접 판단한다 — 별도 타이머를
 * 두면 부모 타이머와 경쟁해서 먼저 언마운트될 수 있다.
 * @param props - 쿨타임 길이와 어둡게 보여줄 아이콘
 * @param props.cooldownMs
 * @param props.children
 * @returns 게이지 엘리먼트
 */
const CooldownGauge = ({ cooldownMs, children }: CooldownGaugeProps): JSX.Element => {
  const [receded, setReceded] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setReceded(true));
    return (): void => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      style={{
        filter: "brightness(0.35) saturate(0.6)",
        clipPath: `inset(0 0 ${receded ? 100 : 0}% 0)`,
        transition: `clip-path ${cooldownMs}ms linear`,
      }}
    >
      <div className="absolute inset-0 bg-slate-900" />
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

export interface EmoteButtonProps {
  emote: EmoteDef;
  onCooldown: boolean;
  onClick: () => void;
  className: string;
  iconClassName: string;
}

/**
 * 감정표현 전송 버튼 하나. 아이콘이 이미지 경로면 이미지로, 아니면 이모지
 * 텍스트로 보여준다. 쿨타임 중에는 바닥부터 차오르는 게이지를 보여주고,
 * 다 차면 한 번 반짝인다.
 * @param props - 버튼에 보여줄 감정표현과 상태
 * @param props.emote
 * @param props.onCooldown
 * @param props.onClick
 * @param props.className
 * @param props.iconClassName
 * @returns 버튼 엘리먼트
 */
const EmoteButton = ({
  emote,
  onCooldown,
  onClick,
  className,
  iconClassName,
}: EmoteButtonProps): JSX.Element => {
  const cooldownMs = emote.cooldownMs ?? 0;
  const [flashing, setFlashing] = useState(false);
  const wasOnCooldownRef = useRef(false);

  useEffect(() => {
    if (onCooldown) {
      wasOnCooldownRef.current = true;
      return;
    }
    if (!wasOnCooldownRef.current) return;
    wasOnCooldownRef.current = false;
    // 쿨타임이 막 끝난 시점 — 다음 틱에 반짝였다가 원래대로 되돌린다.
    Promise.resolve().then(() => setFlashing(true));
    const resetTimer = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    return (): void => clearTimeout(resetTimer);
  }, [onCooldown]);

  const icon = emote.icon.startsWith("/") ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={emote.icon} alt="" className={iconClassName} />
  ) : (
    <>{emote.icon}</>
  );

  return (
    <button
      onClick={onClick}
      disabled={onCooldown}
      title="감정표현"
      className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60 transition hover:enabled:bg-slate-800 ${className}`}
    >
      <span className="relative z-0 flex items-center justify-center">{icon}</span>
      {onCooldown && cooldownMs > 0 && (
        <CooldownGauge cooldownMs={cooldownMs}>{icon}</CooldownGauge>
      )}
      <div
        className={`pointer-events-none absolute inset-0 z-20 bg-white transition-opacity duration-300 ${
          flashing ? "opacity-30" : "opacity-0"
        }`}
      />
    </button>
  );
};

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
    <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-800 px-4 py-4 sm:flex">
      {players.map((p) => {
        const extra = extraLine?.(p.userId) ?? null;
        const activeEmote = activeEmotes.find((e) => e.userId === p.userId) ?? null;
        const activeEmoteDef = activeEmote
          ? EMOTES.find((e) => e.id === activeEmote.emoteId)
          : undefined;
        return (
          <div
            key={p.userId}
            className={`flex items-center justify-between gap-2 overflow-hidden rounded-lg border px-4 py-3 text-base transition ${
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
              {extra && <span className="text-slate-200">{extra}</span>}
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
      <div className="mt-auto flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-400">감정표현</span>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            {EMOTES.slice(0, 1).map((emote) => (
              <EmoteButton
                key={emote.id}
                emote={emote}
                onCooldown={emoteOnCooldown[emote.id] ?? false}
                onClick={() => onSendEmote(emote.id)}
                iconClassName="h-9 w-9"
                className="flex-1 py-2 text-2xl"
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {EMOTES.slice(1).map((emote) => (
              <EmoteButton
                key={emote.id}
                emote={emote}
                onCooldown={emoteOnCooldown[emote.id] ?? false}
                onClick={() => onSendEmote(emote.id)}
                iconClassName="h-[4.5rem] w-[4.5rem]"
                className="flex-1 py-4 text-3xl"
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
