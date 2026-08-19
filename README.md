# 🃏 테이블탑 온라인

> 브라우저에서 바로 모여 함께 즐기는 실시간 보드게임 서비스

🔗 **배포 링크** : [tabletop-online-ppzz.onrender.com](https://tabletop-online-ppzz.onrender.com)

<br />

## 🖥️ 프로젝트 개요

### 📅 개발 기간

2026.08 ~ 진행 중

### 🎯 서비스 목적

평소 카드게임을 즐겨 했지만, 카드게임은 사람이 한자리에 모여야 한다는 제약이 있었습니다. 기존 온라인 서비스들은 원하는 게임이 없거나, 화면 구성과 조작 흐름이 불편해 오래 붙잡고 있기 어려웠습니다.

이러한 생각에서 시작된 **테이블탑 온라인**은 가볍게 브라우저에서 접속해 바로 함께 게임을 즐기는 것을 목표로 만든 서비스입니다. 오프라인에서 마주 앉아 하던 경험을 옮겨오는 것이 목적이었기에, 화면 안에서 발생하는 반응과 몰입감을 중요하게 다뤘습니다.

<br />

## 📋 주요 기능

### 1. 회원가입 없는 게스트 입장

- 첫 방문 시 익명 게스트 id를 쿠키로 발급받아, 로그인 절차 없이 바로 입장합니다.
- 방에 들어갈 때 닉네임만 정하면 되고, 새로고침해도 같은 자리로 복귀합니다.

![게스트 입장](docs/screenshots/lobby.gif)

### 2. 방 만들기 / 참여하기

- 로비에서 공개 방 목록을 확인하고 바로 참여할 수 있습니다.
- 비공개 방은 목록에 노출되지 않고 방 코드로만 입장합니다.
- 방장은 게임 종류·최대 인원·공개 여부를 대기 중에 언제든 변경할 수 있습니다.

![방 만들기](docs/screenshots/create-room.gif)

### 3. 실시간 멀티플레이 게임

| 게임             | 상태    | 설명                                                     |
| ---------------- | ------- | -------------------------------------------------------- |
| 🎲 **야찌**      | 서비스 중 | 주사위 5개를 굴려 13개 점수 항목을 채우고 총점을 겨룹니다. |
| 🂡 **싯헤드**    | 서비스 중 | 볼 수 없는 바닥패를 깔고, 손패를 가장 먼저 비우면 승리합니다. |
| 🃟 **원카드**    | 서비스 중 | 같은 무늬·숫자를 이어 내고, 손패를 가장 먼저 비우면 승리합니다. |
| 🀄 **훌라**      | 준비 중  | 추후 업데이트 예정입니다.                                |

- 모든 진행 상황은 Socket.IO로 즉시 동기화되어, 상대의 차례와 행동이 실시간으로 보입니다.
- 손패처럼 사람마다 보이는 내용이 다른 정보는 서버가 소켓별로 따로 조립해 내려보내, 다른 사람의 패가 클라이언트로 새지 않습니다.

![게임 플레이](docs/screenshots/gameplay.gif)

### 4. 카드·주사위 인터랙션

- 카드를 내고, 먹고, 나눠주는 모든 순간에 카드가 실제로 날아가는 애니메이션과 효과음이 재생됩니다.
- 상대가 낸 카드는 뒷면으로 날아오다 더미 위에서 뒤집히고, 착지하는 순간에 맞춰 더미가 갱신되어 카드가 미리 보이지 않습니다.
- 손패는 랭크순으로 자동 정렬되며, 카드가 많아지면 겹침 폭을 동적으로 줄여 화면을 넘치지 않습니다.

![카드 애니메이션](docs/screenshots/card-motion.gif)

### 5. 실시간 감정 표현

- 텍스트 입력 없이 버튼 한 번으로 상대에게 리액션을 보냅니다.
- 표현마다 영상·이미지와 효과음이 참가자 카드 위에서 재생됩니다.
- 짧은 시간에 반복 입력되기 쉬운 기능이라, 표현별 재사용 대기 시간을 두어 요청 빈도를 제한했습니다.

![감정 표현](docs/screenshots/emote.gif)

### 6. 게임 규칙 사이드바

- 방 안에서 사이드바를 열면 현재 게임의 규칙을 언제든 확인할 수 있어, 처음 하는 사람도 바로 참여할 수 있습니다.

<br />

## 🛠️ 기술 스택

| 항목            | 사용 기술                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**   | ![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)                                                                            |
| **Language**    | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)                                                                                                                                                                                 |
| **Server**      | ![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white) ![Socket.io](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)                                                                        |
| **Database**    | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma%207-2D3748?style=for-the-badge&logo=prisma&logoColor=white)                                                                        |
| **Style**       | ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS%204-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white) ![animate.css](https://img.shields.io/badge/animate.css-FF69B4?style=for-the-badge&logo=css3&logoColor=white)                                                         |
| **Validation**  | ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)                                                                                                                                                                                                     |
| **Convention**  | ![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white) ![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black) ![Husky](https://img.shields.io/badge/Husky-42B983?style=for-the-badge&logo=git&logoColor=white) |
| **Deploy**      | ![Render](https://img.shields.io/badge/Render-000000?style=for-the-badge&logo=render&logoColor=white) ![Neon](https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=postgresql&logoColor=white)                                                                                        |

<br />

## 🗂️ 프로젝트 구조

```
├─ server.ts                  # HTTP + Socket.IO 부트스트랩, 소켓 이벤트 핸들러
├─ prisma/                    # DB 스키마와 마이그레이션
└─ src/
   ├─ app/                    # 라우트 (로비, 방, /api/rooms)
   ├─ components/
   │  ├─ lobby/               # 방 만들기·참여 UI
   │  └─ room/                # 방 공용 UI + 게임별 보드(yatzy·shithead·onecard)
   ├─ hooks/                  # 이벤트 핸들러, 애니메이션 훅
   ├─ utils/                  # 순수 계산 로직
   ├─ constants/              # 게임 목록, 룰북, 점수판 등 정적 데이터
   ├─ server/                 # 방 상태 관리, 게임별 서버 로직
   │  ├─ roomManager.ts       # 방·플레이어 인메모리 상태, 입퇴장·방장 위임
   │  ├─ gameDispatch.ts      # 게임 종류별 로직 위임
   │  └─ yatzy | shithead | onecard/
   ├─ lib/                    # Prisma·소켓 클라이언트
   └─ proxy.ts                # 첫 방문자 게스트 쿠키 발급
```

진행 중인 라운드 상태(주사위, 손패, 차례)는 응답 속도를 위해 소켓 서버 메모리에 두고, DB에는 방 정보와 최종 결과만 기록합니다.

