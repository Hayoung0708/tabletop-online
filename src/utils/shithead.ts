import {
  CARD_FLIGHT_DURATION_MS,
  CARD_FLIGHT_STAGGER_MS,
  HAND_CARD_GAP_PX,
  HAND_CARD_WIDTH_PX,
} from "@/constants/shithead";

/** hover한 카드에서 최소로 보여야 하는 비율(3/4). 이보다 더 가려지면 오른쪽 카드를 밀어 드러낸다. */
const REVEAL_RATIO = 0.75;

/**
 * 카드 여러 장이 연속으로(스태거) 날아가는 비행이 전부 끝나는 데 걸리는
 * 시간(ms). 마지막 카드가 출발하는 시점(스태거 누적) + 한 장의 비행 시간.
 * @param count - 함께 날아가는 카드 수
 * @returns 전체 비행이 끝나는 데 걸리는 시간(ms)
 */
export const cardsFlightMs = (count: number): number =>
  CARD_FLIGHT_DURATION_MS + Math.max(0, count - 1) * CARD_FLIGHT_STAGGER_MS;

/**
 * 쉬는 상태의 카드 간격(px)을 구한다. 영역 폭 안에서 최대한 펼치고, 다 안 들어가면
 * 그만큼만 겹친다(간격이 카드폭보다 좁아짐). 카드가 적으면 기본 간격으로 벌린다.
 * @param count - 손패 카드 수
 * @param availableWidth - 손패 영역의 실제 폭(px)
 * @returns 카드 간 간격(px). 카드폭보다 작으면 그 차이만큼 겹친다.
 */
const restStep = (count: number, availableWidth: number): number => {
  const maxStep = HAND_CARD_WIDTH_PX + HAND_CARD_GAP_PX;
  if (count <= 1 || availableWidth <= 0) return maxStep;
  return Math.min(maxStep, (availableWidth - HAND_CARD_WIDTH_PX) / (count - 1));
};

/**
 * 쉬는 상태에서 각 카드에 적용할 왼쪽 마진(px). 겹칠 때는 음수, 여유 있으면 기본 간격.
 * @param count - 손패 카드 수
 * @param availableWidth - 손패 영역의 실제 폭(px)
 * @returns 왼쪽 마진(px)
 */
export const computeHandMargin = (count: number, availableWidth: number): number =>
  restStep(count, availableWidth) - HAND_CARD_WIDTH_PX;

/**
 * 특정 카드에 hover했을 때 각 카드의 가로 이동량(px) 배열을 구한다. hover 카드의
 * 3/4가 보이도록, 오른쪽 카드들을 마지막 카드를 벽에 고정한 채 더 촘촘히 겹쳐 오른쪽
 * 으로 밀어 공간을 낸다. 오른쪽만으로 부족하면(오른쪽 끝 근처 카드) hover 카드 자체를
 * 왼쪽으로 밀고 왼쪽 카드들을 첫 카드를 벽에 고정한 채 더 촘촘히 겹쳐서 모자란 만큼을
 * 왼쪽에서 마저 확보한다. 양쪽 끝 카드는 벽에 고정되므로 영역을 벗어나지 않는다.
 * 이미 3/4 이상 보이거나 마지막 카드를 hover하면 아무도 움직이지 않는다.
 * @param count - 손패 카드 수
 * @param availableWidth - 손패 영역의 실제 폭(px)
 * @param hoveredIndex - hover한 카드 인덱스. null이면 전부 0
 * @returns 카드별 translateX(px) 배열(길이 count). hover 카드 자신도 왼쪽으로 밀릴 수 있다.
 */
export const computeFanHoverShifts = (
  count: number,
  availableWidth: number,
  hoveredIndex: number | null,
): number[] => {
  const shifts = new Array<number>(count).fill(0);
  if (hoveredIndex === null || count <= 1 || availableWidth <= 0) return shifts;

  const cardWidth = HAND_CARD_WIDTH_PX;
  const step = restStep(count, availableWidth);
  const revealStep = REVEAL_RATIO * cardWidth;
  const followerCount = count - 1 - hoveredIndex;
  // 이미 3/4 이상 보이거나 hover 카드가 마지막이면 밀 필요 없음.
  if (step >= revealStep || followerCount <= 0) return shifts;

  const wallLeft = availableWidth - cardWidth; // 마지막 카드가 고정될 왼쪽 위치
  // hover 카드의 새 왼쪽 위치: 오른쪽에 3/4 공간(revealStep)을 남길 수 있는 한계까지만
  // 오른쪽에 두고, 그 이상이면 왼쪽으로 당긴다.
  const hoveredLeft = Math.min(hoveredIndex * step, Math.max(0, wallLeft - revealStep));

  // 왼쪽 블록(0..hover): 첫 카드를 0에 고정하고 hover 카드를 새 위치까지 균등 압축.
  const stepLeft = hoveredIndex > 0 ? hoveredLeft / hoveredIndex : 0;
  for (let index = 0; index <= hoveredIndex; index += 1) {
    shifts[index] = index * stepLeft - index * step;
  }

  // 오른쪽 블록(hover+1..마지막): 3/4 지점부터 마지막 카드를 벽에 고정하고 균등 압축.
  const startRight = Math.min(hoveredLeft + revealStep, wallLeft);
  const stepRight = followerCount > 1 ? (wallLeft - startRight) / (followerCount - 1) : 0;
  for (let j = 0; j < followerCount; j += 1) {
    const index = hoveredIndex + 1 + j;
    shifts[index] = startRight + j * stepRight - index * step;
  }
  return shifts;
};
