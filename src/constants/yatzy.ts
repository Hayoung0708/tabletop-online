import { ROLL_ANIMATION_MS } from "@/constants/media";

/**
 * 같은 플레이어의 굴리기 요청을 서버가 다시 받아주기까지의 최소 간격.
 * 주사위 애니메이션이 끝나기 전에는 다음 굴림이 의미가 없으므로 그 길이에 맞춘다.
 * 이 간격 안에 들어온 요청은 연타·마우스 채터링으로 보고 무시한다.
 */
export const YATZY_ROLL_COOLDOWN_MS = ROLL_ANIMATION_MS;

/**
 * 굴리기 요청을 보낸 뒤 응답이 끝내 오지 않을 때 클라이언트 잠금을 푸는 시간.
 * 서버가 요청을 거절하면 상태가 바뀌지 않아 잠금이 영영 남기 때문에 둔다.
 */
export const YATZY_ROLL_PENDING_TIMEOUT_MS = 3000;
