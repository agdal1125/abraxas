# ADR-0002 에이전트 도구·플러그인·스킬 구성

- 상태: 확정 (2026-10-31). 설치 여부는 체크리스트로 관리.
- 가용 리소스: Antigravity CLI(`agy`), Claude(claude.ai 프로젝트 "Abraxas", 노션·GitHub 연결)

## 역할 분담

> 2026-10-31 ADR-0004로 대체됨: 코딩 Codex, 아트 agy, 지휘·검수·병합 Claude. 아래 표는 기록용.

| 도구 | 주로 맡는 일 |
| --- | --- |
| Antigravity CLI (`agy`) | 콘텐츠·시스템 설계(작업 지시서 `docs/tasks/` 기준), 구현·테스트, 에셋 생성(이미지 모델), 배포 보조 |
| Claude (프로젝트 채팅) | 설계·코드 검수와 리뷰(`design-review` 스킬, `docs/reviews/`), 작업 지시서 작성, 기획서 유지, 노션 개발 일지 |
| 사람 | 측정 수치·디자인 승인, 비밀값·배포·결제, 아트 최종 선택 |

두 에이전트 모두 `AGENTS.md`, `.agents/rules/`, `.agents/skills/`, `docs/memory/`를 읽는다. Antigravity는 `.agents/` 경로를 기본으로 읽고, Claude Code는 `CLAUDE.md`가 `AGENTS.md`를 불러오며 스킬은 `npm run setup`(`scripts/link-agent-config.mjs`)으로 연결한다.

## Antigravity 설정

규칙·스킬 위치 (공식 문서 기준, 2026-10-31):

- 규칙: `AGENTS.md`(항상 적용) + `.agents/rules/*.md`(frontmatter `trigger` 필수, 하위 폴더는 무시됨). 파일당 24KB, 항상 적용되는 규칙 합계 20,000토큰 한도.
- 스킬: `.agents/skills/<이름>/SKILL.md`. CLI에서는 스킬 이름이 슬래시 명령(`/devlog` 등)이 된다.
- 플러그인: `agy plugin install <이름|GitHub URL>`, 목록은 `agy plugin list`.
- MCP: `agy mcp add|list|...`.

### 설치 권장 (마켓플레이스)

| 플러그인 | 쓰는 곳 | 우선순위 |
| --- | --- | --- |
| Firebase | Hosting·Auth·Firestore 설정, 보안 규칙 | 필수 |
| Google Cloud | Cloud Run 배포, Secret Manager | 필수 |
| Chrome DevTools | 모바일 뷰포트 디버깅, 성능 측정 | 필수 |
| Modern Web Guidance | 인앱 브라우저 호환, 웹 표준 | 권장 |
| Context7 | 라이브러리 최신 문서 조회 (Phaser, inkjs, Go 모듈) | 권장 |
| CodeRabbit | PR 1차 코드 리뷰 | 권장 |
| Notion | 개발 일지 자동 기록 | 권장 |
| Sentry | 출시 후 오류 수집 | 출시 전 |
| Figma 또는 Canva | UI 시안을 디자인 도구로 관리할 때 | 선택 |

### 설치 권장 (스킬)

- **Phaser 공식 스킬 28종**: Phaser 저장소의 `skills/` 폴더. 씬, 입력, 트윈, 로딩, 스케일, v3→v4 마이그레이션 등. 설치: `npx skills add phaserjs/phaser` (`.agents/skills/`에 설치됨). 설명만 먼저 읽히므로 전부 설치해도 부담이 적다.
- **이 저장소 자체 스킬** (`.agents/skills/`): `devlog`, `art-asset`, `ink-scenario`, `scoring-change`.

### 아트 생성

- Antigravity 에이전트는 이미지 생성 모델(Nano Banana Pro)을 필요할 때 스스로 호출한다. UI 시안, 에셋, 다이어그램에 쓸 수 있다. App/IDE에서 공식 확인된 기능이고, CLI에서 같은 기능이 되는지는 첫 사용 때 확인한다.
- CLI에서 안 되면 대안: Gemini API 키 + Gemini API 플러그인, 또는 커뮤니티 `nano-banana` 스킬. 둘 다 생성량에 비례해 비용이 든다.
- 절차는 `art-asset` 스킬을 따른다(후보 생성 → 사람 선택 → 등록).

## Claude 쪽에서 쓸 기능

| 기능 | 쓰는 곳 |
| --- | --- |
| 디자인 리뷰 스킬 (design-critique, accessibility-review) | 화면 시안 검토, 대비·터치 영역 점검 |
| UX 문구 스킬 (ux-copy) | 버튼, 오류, 빈 화면, 결과 카드 문구 |
| 한국어 윤문 스킬 (humanize-korean) | NPC 대사의 번역투·AI 말투 제거 |
| 사용자 리서치 스킬 (user-research, research-synthesis) | 플레이테스트 설계와 결과 정리 |
| 영상 제작 (Remotion 스킬) | 출시 홍보용 숏폼 영상 |
| 노션 커넥터 | 개발 일지, 기획서 사본 |
| Claude 문서 | 기획서 원본 |

## 하지 않기로 한 것

- 커뮤니티 스킬 묶음을 대량으로 설치하지 않는다. 첫 로딩이 느려지고 규칙이 서로 충돌한다. 필요한 것만 하나씩 검토 후 설치한다.
- 출처가 불분명한 MCP 서버에 비밀값을 넘기지 않는다.
