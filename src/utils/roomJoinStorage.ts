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
 * 지금 화면이 새로고침으로 열린 것인지 확인한다. 새로고침이면 방에 있던
 * 사람이 잠깐 끊긴 것뿐이라 닉네임 폼 없이 바로 재입장해야 하고, 그 외의
 * 진입(로비에서 다시 들어오기, 뒤로가기 등)이라면 닉네임을 다시 정할 수
 * 있어야 한다.
 * @returns 새로고침으로 들어온 화면이면 true
 */
export const isPageReload = (): boolean => {
  const [entry] = window.performance.getEntriesByType("navigation");
  return (entry as PerformanceNavigationTiming | undefined)?.type === "reload";
};

/**
 * "이 방에 참가함" 표시를 지운다 (참가 실패, 의도적 퇴장 시).
 * @param code - 방 코드
 */
export const clearRoomJoined = (code: string): void => {
  window.localStorage.removeItem(joinedRoomKey(code));
};
