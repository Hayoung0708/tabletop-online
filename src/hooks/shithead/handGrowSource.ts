"use client";

import { SHITHEAD_ANCHOR } from "@/constants/shithead";

/** 손패에 새로 들어온 카드가 어디서 날아온 것인지 잠깐 기억해 두는 표. */
const sources = new Map<string, { anchor: string; until: number; sound?: string }>();

/**
 * 이 플레이어의 다음 손패 증가가 어디서 온 것인지 등록한다(기본은 덱).
 * 줍기처럼 더미에서 오는 경우에만 따로 알려주면 된다.
 * @param playerId - 카드를 받는 플레이어
 * @param anchor - 출발 지점 앵커 이름
 * @param ttlMs - 이 정보가 유효한 시간(ms)
 * @param sound - 출발 지점과 무관하게 이번 증가에 쓸 소리 (원카드 공격 벌칙 등)
 */
export const setHandGrowSource = (
  playerId: string,
  anchor: string,
  ttlMs: number,
  sound?: string,
): void => {
  sources.set(playerId, { anchor, until: Date.now() + ttlMs, sound });
};

/**
 * 이 플레이어의 손패 증가 출발 지점을 알아낸다. 등록된 게 없거나 시간이 지났으면
 * 덱에서 온 것으로 본다.
 * @param playerId - 카드를 받는 플레이어
 * @returns 출발 지점 앵커 이름
 */
export const getHandGrowSource = (playerId: string): string => {
  const entry = sources.get(playerId);
  if (!entry || Date.now() > entry.until) return SHITHEAD_ANCHOR.deck;
  return entry.anchor;
};

/**
 * 이 플레이어의 손패 증가에 지정된 소리를 알아낸다. 등록된 게 없으면 null —
 * 출발 지점(덱/더미)에 맞는 기본 소리를 쓴다.
 * @param playerId - 카드를 받는 플레이어
 * @returns 소리 파일 경로, 없으면 null
 */
export const getHandGrowSound = (playerId: string): string | null => {
  const entry = sources.get(playerId);
  if (!entry || Date.now() > entry.until) return null;
  return entry.sound ?? null;
};
