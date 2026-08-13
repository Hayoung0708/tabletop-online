<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-agent-rules -->

# 테이블탑 온라인 — 작업 규칙 (항상 지킬 것)

## 0. 프로젝트 개요

브라우저에서 회원가입 없이 모여 즐기는 실시간 보드게임 서비스.

**Next.js 16(App Router) + React 19 + TypeScript**, 스타일은 **Tailwind CSS 4**.

- `server.ts`가 Next 요청 핸들러와 **Socket.IO** 서버를 한 포트에 함께 띄운다.
개발 서버도 `next dev`가 아니라 `tsx watch server.ts`(`npm run dev`)로 실행한다.
- **Prisma 7 + PostgreSQL(Neon)**. 진행 중인 라운드 상태(주사위·손패·차례)는 소켓
서버 메모리(`roomManager`)에 두고, DB에는 방 정보와 최종 결과만 기록한다.
- 로그인 없이 `proxy.ts`가 발급하는 게스트 쿠키(`GUEST_COOKIE`)로 사용자를 식별한다.

## 1. 디렉토리 — 무엇을 어디에 두는가

```
server.ts              소켓 이벤트 핸들러 (얇게 유지: 검증 → 로직 호출 → emit)
src/app/               라우트와 API 라우트
src/components/        UI. room/<game>/ 아래에 게임별 보드를 둔다
src/hooks/             액션·애니메이션 등 "동작". 게임별은 hooks/<game>/
src/utils/             입력만으로 결과가 정해지는 순수 계산 로직
src/constants/         정적 데이터·설정값(게임 목록, 룰북, 타이밍 상수)
src/server/            방 상태와 게임별 서버 로직. 게임별은 server/<game>/
src/lib/               외부 클라이언트 인스턴스(Prisma, 소켓)
```

- 액션은 `hooks`, 순수 계산은 `utils`, 값은 `constants` — 이 셋을 섞지 않는다.
- 컴포넌트에서 소켓을 직접 `emit`하지 않고 `hooks/<game>/use<Game>Actions.ts`를 거친다.
- 게임 규칙은 클라이언트에 두지 않는다. 판정은 항상 `src/server/<game>/gameLogic.ts`.

### 새 게임을 추가할 때

1. `src/server/<game>/deck.ts` + `gameLogic.ts` — 상태 타입, `createIdle*`,
 `start*`, `public*GameState`, `check*LastPlayerStanding`을 만든다.
2. `src/server/gameDispatch.ts`의 분기 4곳에 새 게임을 연결한다.
3. `server.ts`에 게임별 소켓 이벤트를 추가한다.
4. `src/constants/games.ts`(로비 목록)와 `rulebook.ts`(방 안 규칙)를 채운다.
5. `src/components/room/<game>/`에 보드를 만들고 `RoomClient`에서 분기한다.

## 2. 서버·클라이언트 신뢰 경계

- **서버가 유일한 진실이다.** 클라이언트가 보낸 값은 전부 의심하고, 차례·소유·합법
수 여부를 서버에서 다시 검증한다(`assertTurn` 등). 통과 못 하면 예외를 던지고
`error_message`로 돌려준다.
- **비공개 정보는 애초에 내려보내지 않는다.** 손패처럼 사람마다 다른 정보는
`public*GameState(room, forUserId)`가 소켓별로 걸러서 만든다. "클라이언트에서 안
보여주기"로 숨기지 않는다.
- 연출용 이벤트(카드 비행 등)는 **상태 브로드캐스트보다 먼저** emit한다 — 클라이언트가
아직 남아 있는 이전 DOM에서 출발 위치를 찾기 때문이다.
- 짧은 시간에 반복 호출될 수 있는 기능(감정 표현 등)은 재사용 대기 시간을 둔다.

## 3. 애니메이션·효과음

카드 연출은 싯헤드에서 만든 공용 부품을 **모든 게임이 그대로 쓴다**. 게임마다 새로
만들지 말고 아래 부품에 연결한다(원카드가 이 방식으로 붙어 있다).

| 부품                                        | 역할                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `SHITHEAD_ANCHOR` + DOM의 `data-anchor`     | 카드가 출발·도착할 좌표 기준점(덱, 더미, 플레이어별 손패·필드·바닥패 자리) |
| `ShitheadCardMotions`                       | 화면 위에 뜬 비행 오버레이. 소켓 이벤트를 구독해 카드를 날리고 착지 소리를 낸다 |
| `CardFan`                                   | 손패 겹침·hover 레이아웃. 아래 훅들을 붙여 준다                            |
| `useHandGrowIn`                             | 손패가 늘어날 때 새 카드는 출발 지점에서 날아오고, 기존 카드는 FLIP으로 밀린다 |
| `handGrowSource`                            | 다음 손패 증가의 출발 지점·소리를 잠깐 등록(더미 줍기, 공격 벌칙 등)       |
| `useHandDealIn` / `useHandDealInOnMount`    | 게임 시작 딜. 딜 소켓 이벤트가 있으면 앞의 것, 없으면 뒤의 것을 쓴다        |
| `DealingContext`                            | 딜 연출 동안 실제 카드를 감춰 "빈 자리가 채워지는" 느낌을 만든다           |
| `constants/shithead.ts`                     | 모든 타이밍 상수                                                           |
| `constants/media.ts` + `utils/sound.ts`     | 소리 경로와 재생                                                           |

### 새 게임에 연출을 붙일 때

1. 덱·더미에 `data-anchor={SHITHEAD_ANCHOR.deck / .pile}`, 플레이어마다 `field`·`hand`
   앵커를 단다. 앵커가 없으면 연출이 통째로 조용히 사라진다.
2. 카드가 놓인 실제 자리에서 출발시키려면 카드 엘리먼트에 `data-card-id`가 있어야
   한다(`PlayingCard`가 이미 붙인다). 못 찾으면 뒤집으며 날아가는 연출로 대체된다.
3. 서버는 `<game>_play` 이벤트를 `{ playerId, cards }`로 **상태 브로드캐스트보다 먼저**
   emit하고, `ShitheadCardMotions`에서 그 이벤트를 같은 핸들러에 구독시킨다.
4. 손패로 들어오는 카드는 별도 이벤트가 필요 없다 — `useHandGrowIn`이 장수 증가를
   감지한다. 출발 지점이나 소리만 다르면 `setHandGrowSource`로 미리 알린다.
5. 더미 맨 위 카드는 비행이 착지할 때까지 감춘다(`shithead_play_landed` window 이벤트
   수신 + 예비 타임아웃). 안 그러면 날아오기도 전에 결과가 보인다.
6. 시작 딜은 딜 이벤트가 있으면 `useHandDealIn`, 없으면 `useHandDealInOnMount`를 쓰되
   **아직 한 수도 두지 않았을 때만** 켠다(진행 중 재접속에서 딜이 다시 돌면 안 된다).

### 소리

**소리는 카드가 어디서 왔는지를 따른다.** 같은 "먹기"라도 출처가 다르면 소리가 다르다.

| 상수                           | 파일                | 언제                                            |
| ------------------------------ | ------------------- | ----------------------------------------------- |
| `CARD_TAKE_FROM_DECK_SOUND_SRC` | `take-from-deck.mp3` | 덱에서 한 장씩 뽑을 때 — 시작 딜, 손패 보충, 원카드 일반 먹기 |
| `CARD_TAKE_FROM_PILE_SOUND_SRC` | `take-from-pile.mp3` | 더미를 쓸어올 때 — 싯헤드 줍기, 원카드 공격 벌칙(여러 장) |
| `CARD_PLACE_SOUND_SRC`          | `place-card.mp3`     | 카드를 더미에 내려놓을 때(비행 착지)            |

- 원카드 공격 벌칙은 카드가 **덱에서** 날아오지만 소리는 더미 쪽을 쓴다 — 여러 장을
  한꺼번에 쓸어담는 느낌이 맞기 때문이다. 이처럼 출발 지점과 소리가 갈릴 때는
  `setHandGrowSource(playerId, 앵커, ttl, 소리)`의 네 번째 인자로 소리만 따로 지정한다.
- 경로는 `constants/media.ts`에만 두고, 재생은 `utils/sound.ts`를 거친다.
- 여러 플레이어에게 같은 소리가 동시에 날 수 있으면 `playSoundOnce`(80ms 디듀프)를 쓴다.
- 내려놓는 소리는 착지보다 `PLACE_SOUND_LEAD_MS` 먼저 재생해야 착지 순간에 들린다.
- `REFILL_SOUND_DELAY_MS`(300ms) 지연은 **싯헤드 보충 전용**이다. 카드를 낸 직후
  자동 보충이라 착지 소리와 겹쳐서 떼어 놓은 값이다. 앞서 울릴 착지 소리가 없는
  동작(원카드 먹기 등)에 이 경로를 태우면 소리만 늦게 들린다 — 그런 동작은
  `setHandGrowSource`로 소리를 지정해 지연 없이 재생한다.
- 사용자 조작으로 시작된 소리만 낸다. 자동재생 차단은 조용히 무시한다.

### 지킬 것

- 타이밍은 타이머로 짐작하지 말고 **실제 착지 이벤트**에 맞춘다. 시계가 어긋나면 카드가
  잠깐 사라졌다 나타난다.
- 앵커·레이아웃이 아직 준비되지 않았을 수 있다. 한 번 실패했다고 끝내지 말고 짧게
  재시도한 뒤 포기한다(50ms × 12회).
- z-index는 비행 오버레이가 `z-40`, 손패가 `z-50`이다 — 나가는 카드가 남은 카드 아래를
  지나가야 자연스럽다.
- 새로운 시간 값은 반드시 `constants`에 이름을 붙여 둔다. 컴포넌트에 숫자를 박지 않는다.

## 4. 코드 스타일 — 클린 코드

### 기본 태도

- 베테랑 개발자가 짠 것처럼 **읽기 쉽고 고치기 쉬운** 코드를 지향한다.
- **YAGNI** — 지금 필요 없는 기능·추상화·설정은 만들지 않는다. 구현이 하나뿐인
인터페이스, 값이 하나뿐인 config, "나중을 위한" 스캐폴딩 금지.
- **중복보다 잘못된 추상화가 더 나쁘다.** 세 번째로 같은 코드를 쓸 때 묶는다.
- 코드를 **더하는 것보다 지우는 것**을 먼저 검토한다. 죽은 코드·주석 처리된 코드는
남기지 않는다(히스토리는 git이 갖고 있다).
- 버그는 증상이 아니라 **원인**을 고친다. 호출부마다 가드를 넣지 말고 공통 함수에서
한 번 막는다.

### 함수·이름

- 함수 하나는 하나의 일만 한다. 60줄을 넘으면 쪼갤 곳을 찾는다(ESLint 경고).
- 중첩보다 **조기 반환**. 예외 상황을 먼저 걸러내고 본문은 평평하게 둔다.
- 매개변수가 3개를 넘으면 객체로 묶고 구조분해로 받는다.
- **매직 넘버·문자열 금지.** 타이밍·크기·경로는 `constants`에 이름을 붙여 둔다.

### 네이밍 규칙

이름은 줄이지 않는다(`cfg`/`res`/`idx`/`btn` 금지). 역할별로 접두사를 통일한다.

| 대상                        | 규칙            | 예                                       |
| --------------------------- | --------------- | ---------------------------------------- |
| 컴포넌트 안의 이벤트 핸들러 | `handle*`       | `handleCardClick`, `handleSubmit`        |
| props로 받는 콜백           | `on*`           | `onDraw`, `onPlayCard`, `onCancel`       |
| 소켓·DOM 이벤트 리스너      | `on` + 이벤트명 | `onecard_play` → `onPlay`, `onRoomState` |
| 커스텀 훅                   | `use*`          | `useRoomSocket`, `useOneCardActions`     |
| 훅이 돌려주는 액션          | 동사구          | `playCard`, `drawCards`, `copyRoomCode`  |
| 불리언 값·props             | `is*`/`has*`/`can*` | `isMyTurn`, `hasStarted`, `canDraw`  |
| 순수 계산 함수              | `동사 + 대상`   | `computeHandMargin`, `canPlayOneCard`    |
| 상수                        | `SCREAMING_SNAKE` | `CARD_FLIGHT_DURATION_MS`              |
| 타입·인터페이스             | `PascalCase`    | `OneCardGameData`, `CardFanProps`        |
| 컴포넌트 props 타입         | `<컴포넌트명>Props` | `OneCardMyHandProps`                 |

- `handle*`은 컴포넌트 안에서 정의한 함수, `on*`은 밖에서 받거나 밖으로 넘기는
  콜백이다. 이 둘을 바꿔 쓰지 않는다(`saveEdit`처럼 접두사 없는 핸들러 금지).
- 소켓 이벤트 이름은 `<game>_<action>` snake_case(`onecard_play`, `shithead_pickup`).
- 게임별 파일·심볼은 게임 이름을 접두사로 단다(`OneCard*`, `Shithead*`, `Yatzy*`).

### 파일

- 컴포넌트 `PascalCase.tsx`, 훅 `useThing.ts`, 그 외 `camelCase.ts`.
- 파일 하나에 컴포넌트 하나. 내부에서만 쓰는 작은 조각은 같은 파일에 둬도 된다.
- import는 경로 별칭 `@/`를 쓴다(상대 경로 `../../` 금지).

### React

- 상태는 최소로 두고, 다른 상태에서 계산되는 값은 **렌더 중에 계산**한다.
`useEffect`로 상태를 상태에 동기화하지 않는다.
- `useEffect`는 외부 시스템과의 동기화(소켓 구독, 타이머, DOM 측정)에만 쓰고,
구독·타이머는 정리 함수에서 반드시 해제한다.
- 애니메이션은 리렌더로 흉내내지 말고 Web Animations(`element.animate`)로 다룬다.
좌표 기준점은 `data-anchor` 속성으로 잡는다(`SHITHEAD_ANCHOR` 참고).

### 주석

- **모든 주석은 한국어로 작성한다.**
- "무엇을 하는지"가 아니라 **"왜 이렇게 했는지"**를 적는다. 특히 그렇게 안 하면
깨지는 이유(타이밍, 프레임워크 제약, 브라우저 동작)를 남긴다.

## 5. 타입

- `any` 타입 금지.
- 함수 매개변수·반환 타입을 명시한다(추론에 기대지 않는다).
- 서버 상태와 클라이언트로 나가는 공개 상태 타입을 분리한다
(`OneCardGameData` ↔ `PublicOneCardGameState`).

## 6. ESLint 로컬 규칙 (`eslint.config.mjs`에서 강제)

- `any` 금지 / 함수 경계 타입 명시 / 구조분해 안 된 변수 접근 금지.
- `function` 키워드 금지 — 모든 함수는 화살표 함수.
- named import·export만 허용. 예외는 프레임워크가 default export를 강제하는
`src/app/**/page.tsx` 같은 특수 파일과 설정 파일뿐이다.
- 이름 붙은 모든 함수에 JSDoc(설명 + `@param` + `@returns`).
- 경고: 함수 60줄 초과, 복잡도 10 초과. 새 코드에서 경고를 늘리지 않는다.

## 7. 테스트/검증

- **봇 테스트 금지.** 소켓 봇으로 게임을 자동 플레이시키며 검증하지 않는다.
- 검증은 `npm run type-check` + `npm run lint` + 브라우저 수동 확인으로 한다.
- 순수 로직(덱, 판정, 점수 계산)은 필요하면 일회성 스크립트로 시뮬레이션해 확인하되,
저장소에 남기지 않는다.
- 작업을 끝냈다고 말하기 전에 타입·린트를 실제로 돌려 결과를 확인한다.
미구현 분기나 TODO를 남긴 채 완료로 보고하지 않는다.

## 8. Git / 커밋

- **커밋은 사용자가 "커밋해"라고 말했을 때만 한다.** 그 전에는 어떤 이유로도 커밋하지
않는다. 말한 뒤에는 메시지를 따로 승인받지 말고 아래 규칙에 맞춰 바로 커밋한다.
- 작업은 `dev` 브랜치에서 한다. `master`는 배포 전용이며 별도 승인 없이 병합·푸시하지
않는다.
- 커밋 메시지는 한국어 한 줄 요약에 타입 접두사를 붙인다: `feat:`, `fix:`, `docs:`,
`refactor:`, `chore:`. 요약은 "무엇을 했는지"를 50자 안팎으로 적고 마침표는 쓰지
않는다. 배경이나 근거가 필요하면 빈 줄 뒤 본문에 `-` 목록으로 적는다.
- 한 커밋은 한 가지 변경만 담는다. 포맷팅과 기능 변경을 섞지 않는다.

## 9. 툴체인

- ESLint(flat config) + Prettier + Husky(pre-commit) + lint-staged + `tsc --noEmit`.
pre-commit에서 lint-staged와 타입체크가 돌기 때문에 훅을 건너뛰지 않는다.
- Prettier 설정이 포맷의 기준이다(`printWidth` 90, 큰따옴표, 세미콜론, trailing comma).
포맷 때문에 다투지 말고 `npm run format`을 돌린다.
- `.env`는 커밋하지 않는다(`.gitignore`의 `.env*`). 필요한 환경 변수는 `DATABASE_URL`.
- 응답 스타일은 caveman(간결), 구현 방침은 ponytail(최소 구현) 플러그인을 전제로 한다.
플러그인이 없어도 위 규칙만 지키면 된다.

<!-- END:project-agent-rules -->

