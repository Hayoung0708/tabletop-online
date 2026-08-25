"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { EmoteDef } from "@/constants/media";
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
export const EmoteButton = ({
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
      title={emote.label}
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
