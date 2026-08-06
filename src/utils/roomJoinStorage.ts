const NICKNAME_STORAGE_KEY = "yatzy_nickname";

/**
 * 방 code별 "이미 참가했음" 표시 localStorage 키를 만든다.
 * @param code - 방 코드
 * @returns localStorage 키
 */
const joinedRoomKey = (code: string): string => `yatzy_joined_${code}`;

/**
 * 마지막으로 사용한 닉네임을 읽는다.
 * @returns 저장된 닉네임, 없으면 null
 */
export const readSavedNickname = (): string | null => {
  return window.localStorage.getItem(NICKNAME_STORAGE_KEY);
};

/**
 * 이 방에 실제로 참가한 적이 있는지 확인한다 (새로고침 시 자동 재입장 판단용).
 * @param code - 방 코드
 * @returns 참가 이력 여부
 */
export const hasJoinedRoomBefore = (code: string): boolean => {
  return window.localStorage.getItem(joinedRoomKey(code)) === "1";
};

/**
 * 닉네임과 "이 방에 참가함" 표시를 저장한다.
 * @param code - 방 코드
 * @param nickname - 참가에 사용한 닉네임
 */
export const markRoomJoined = (code: string, nickname: string): void => {
  window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
  window.localStorage.setItem(joinedRoomKey(code), "1");
};

/**
 * "이 방에 참가함" 표시를 지운다 (참가 실패, 의도적 퇴장 시).
 * @param code - 방 코드
 */
export const clearRoomJoined = (code: string): void => {
  window.localStorage.removeItem(joinedRoomKey(code));
};
