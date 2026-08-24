"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { setHandGrowSource } from "@/hooks/shithead/handGrowSource";
import {
  CARD_PLACE_SOUND_SRC,
  CARD_TAKE_FROM_DECK_SOUND_SRC,
  CARD_TAKE_FROM_PILE_SOUND_SRC,
} from "@/constants/media";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { playSoundOnce } from "@/utils/sound";
import type { HulaDrawSource } from "@/server/hula/gameLogic";

/** 가져오기 소리·출발점 지정이 유효한 시간(ms) — 곧바로 오는 손패 증가에만 적용. */
const DRAW_SOURCE_TTL_MS = 1200;

/**
 * 훌라 카드 소리를 소켓 이벤트에 붙인다. 가져오기는 덱/더미 중 어디서 왔는지에
 * 따라 출발점과 소리가 다르고, 등록·붙이기는 바닥에 내려놓는 소리를 낸다.
 */
export const useHulaSounds = (): void => {
  useEffect(() => {
    const socket = getSocket();
    /**
     * 가져오기 알림 — 이 플레이어의 다음 손패 증가 출발점과 소리를 지정한다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 카드를 가져간 플레이어
     * @param root0.source - 가져온 곳
     */
    const onDraw = ({
      playerId,
      source,
    }: {
      playerId: string;
      source: HulaDrawSource;
    }): void => {
      const fromDiscard = source === "discard";
      setHandGrowSource(
        playerId,
        fromDiscard ? SHITHEAD_ANCHOR.pile : SHITHEAD_ANCHOR.deck,
        DRAW_SOURCE_TTL_MS,
        fromDiscard ? CARD_TAKE_FROM_PILE_SOUND_SRC : CARD_TAKE_FROM_DECK_SOUND_SRC,
      );
    };
    /** 조합 등록 — 여러 장을 한꺼번에 내려놓으니 더미 쓸어오는 소리를 쓴다. */
    const onMeld = (): void => playSoundOnce(CARD_TAKE_FROM_PILE_SOUND_SRC);
    /** 붙이기 — 카드 한 장이 바닥에 놓이는 소리. */
    const onAppend = (): void => playSoundOnce(CARD_PLACE_SOUND_SRC);

    socket.on("hula_draw", onDraw);
    socket.on("hula_meld", onMeld);
    socket.on("hula_append", onAppend);
    return (): void => {
      socket.off("hula_draw", onDraw);
      socket.off("hula_meld", onMeld);
      socket.off("hula_append", onAppend);
    };
  }, []);
};
