<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-agent-rules -->

# 테이블탑 온라인 — 작업 규칙 (항상 지킬 것)

## 0. 최우선 — 새 환경/새 계정 세팅

이 저장소를 새 환경(다른 Claude Code 계정 등)에서 처음 연 경우 가장 먼저 할 일:

1. Claude Code에 `caveman`, `ponytail` 플러그인이 설치·활성화돼 있는지 확인한다. 없으면 사용자에게 설치를 요청한다 — 에이전트가 원격 스크립트를 임의로 다운로드/실행해 설치하지 않는다(보안 정책상 금지, 사용자가 직접 설치해야 함).
2. 플러그인 설치 후 `caveman:caveman-init` 스킬로 저장소별 caveman 활성화 규칙 파일들을 심는다(사용자 승인 하에 진행).
3. 아래 규칙 전체를 숙지한 뒤 작업을 시작한다.
4. 자세한 이 프로젝트의 작업 이력/맥락은 `PROJECT_SUMMARY.md` 참고.

## 1. 테스트/검증

- **봇 테스트 사용 금지.** 소켓 봇으로 게임을 자동 플레이시키며 검증하지 않는다. `tsc`/`eslint`와 브라우저 수동 확인으로 검증한다.

## 2. Git / 커밋

- **커밋은 반드시 사용자의 명시적 허락을 받은 뒤에만 한다.** 커밋 메시지를 먼저 채팅에 보여주고, 그 턴에는 커밋하지 않는다 — 별도의 턴에서 사용자가 명확히 승인해야 커밋을 실행한다.
- 작업은 `dev` 브랜치에서 한다. `master`는 배포 전용이며 별도 승인 없이 병합/푸시하지 않는다.

## 3. 코드 스타일 — ponytail 기반

- 베테랑 개발자가 짠 것처럼 읽기 쉽고 수정하기 쉬운 클린 코드/클린 아키텍처를 지향한다.
- YAGNI: 필요 없는 기능/추상화는 만들지 않는다. 가장 단순하고 짧지만 올바른 해법을 우선한다.
- 컴포넌트는 책임 단위로 분리하고, 디렉토리 구조는 최신 트렌드(관심사별 분리: components/hooks/utils/constants/server 등)를 따른다.
- **모든 주석은 한국어로 작성한다.**

## 4. 툴체인

- ESLint(flat config) + Prettier + Husky(pre-commit) + lint-staged + `tsc --noEmit` 타입체크를 사용한다.

## 5. ESLint 로컬 규칙 (필수)

- `any` 타입 사용 금지.
- 타입 추론에 의존하지 않는다 — 함수 매개변수/반환 타입을 명시한다.
- 구조분해(destructuring) 안 된 변수 사용 금지 — props/객체는 구조분해해서 쓴다.
- 모든 함수에 JSDoc을 작성한다.
- 책임별로 분리한다: 액션(이벤트 핸들러 등)은 `hooks`, 순수 계산 로직은 `utils`, 정적 데이터/설정값은 `constants`.
- 함수 하나는 기능 하나만 수행한다(단일 책임).
- `function` 키워드 금지 — 모든 함수는 화살표 함수로 작성한다.
- import/export는 named import/export만 허용한다(default export/import 금지).

<!-- END:project-agent-rules -->
