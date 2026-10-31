# Abraxas — 에이전트 작업 지침

이 파일은 Antigravity, Claude Code, 기타 AGENTS.md를 읽는 모든 에이전트가 매 작업마다 읽는다. 짧게 유지한다. 세부 규칙은 `.agents/rules/`에 있고 필요할 때 읽힌다.

## 프로젝트

- 기억을 잃은 주인공이 30분 동안 마을 NPC들과 지내며 선택으로 16유형 중 자신의 성격을 찾는 모바일 웹 심리 테스트형 연애 어드벤처.
- 기획서: `docs/gdd/README.md` (원본은 Claude 문서 "Abraxas 기획서 v2.0").
- 기술 스택: `docs/adr/0001-tech-stack.md`. Phaser 4 + TypeScript / Go API on Cloud Run / Firebase Hosting·Anonymous Auth·Firestore.

## 언제나 지킬 것

1. 사용자와의 대화, 커밋 메시지 본문, 문서는 한국어로 쓴다. 코드 식별자와 주석은 영어.
2. 측정 무결성 규칙(`.agents/rules/game-design-policy.md`)은 기획서보다 먼저 확인한다. 성향 수치·문항 수·초대권 수치를 바꾸는 변경은 사람의 승인 없이 하지 않는다.
3. 플레이어에게 보이는 텍스트에 내부 축 이름(A~E, O/I 등 코드), 성향 수치, 호감도 숫자, 'MBTI'라는 단어를 넣지 않는다.
4. 초대권·결과 저장은 서버만 판정한다. 클라이언트 값은 신뢰하지 않는다.
5. 비밀값(API 키, 서비스 계정, Kakao 키)을 코드·문서·로그에 쓰지 않는다. Secret Manager와 `.env.local`(git 제외)만 쓴다.
6. 새 외부 의존성(npm, Go 모듈)을 추가할 때는 이유를 PR 설명에 적는다. Go는 표준 라이브러리를 먼저 검토한다.
7. 작업이 끝나면 `docs/memory/`와 `docs/devlog/`를 갱신한다 (`.agents/rules/memory-protocol.md`).

## 작업 방식

- 큰 변경은 구현 전에 계획을 먼저 보여주고 확인받는다.
- 하나의 PR에는 하나의 목적만 담는다.
- 끝났다고 말하기 전에: 클라이언트 `npm run typecheck && npm test`, 서버 `go vet ./... && go test ./... && govulncheck ./...`.
- 모르는 API는 추측하지 않는다. Phaser는 설치된 Phaser 스킬, 그 외는 공식 문서를 확인한다.

## 문서 지도

| 무엇을 | 어디에 |
| --- | --- |
| 확정된 결정과 그 이유 | `docs/memory/decisions.md`, `docs/adr/` |
| 현재 진행 상황, 다음 할 일 | `docs/memory/status.md` |
| 겪어본 함정, 우회법 | `docs/memory/lessons.md` |
| 날짜별 작업 기록 | `docs/devlog/YYYY-MM-DD.md` |
| 아트 기준 | `docs/art/style-guide.md` |
