# T004 클라이언트 뼈대 (로컬 실행)

이 완료된 작업 지시의 세로 화면 기준은 당시 기준이다. 현재 화면 정책은 2026-11-01 가로 우선 결정과 `docs/tasks/T011-landscape-brief.md`를 따른다.

- 담당: 로컬 에이전트 (Antigravity CLI `agy`)
- 검수: Claude (코드 리뷰)
- 승인: 사람
- 브랜치: `feat/client-skeleton`

## 목표

`client/`에 Phaser 4 + TypeScript + Vite 뼈대를 만든다. **로컬 `npm run dev`로 세로 화면이 뜨고, typecheck·test·build가 통과하는 것까지가 범위**다. Firebase·서버 연동, inkjs, 실제 게임 내용은 범위 밖이다.

## 먼저 읽을 것

1. `.agents/rules/frontend-phaser.md` — 클라이언트 규칙 (위반 금지)
2. `.agents/rules/cross-platform.md` — macOS·Windows 병행
3. `.agents/rules/security.md` — 의존성 항목
4. Phaser 4 API는 설치된 Phaser 스킬(`game-setup-and-config`, `scale-and-responsive`, `scenes`, `text-and-bitmaptext`)을 확인한다. v3 예제를 그대로 옮기지 않는다.

## 범위

| 항목 | 내용 |
| --- | --- |
| `client/package.json` | `"type": "module"`, `"private": true`. 의존성은 아래 표의 정확한 버전만 |
| 스크립트 | `dev`(vite), `build`(vite build), `preview`, `typecheck`(tsc --noEmit), `test`(vitest run), `check:size`(빌드 결과 크기 검사) |
| `client/tsconfig.json` | `strict: true`, `noUncheckedIndexedAccess: true`, ES2022 이상, `moduleResolution: bundler` |
| `client/vite.config.ts` | 기본 설정 + vitest 설정(`environment: node`, `src/**/*.test.ts`) |
| `client/index.html` | 모바일 viewport 메타, 여백 없는 전체 화면, 한국어 `lang="ko"` |
| `src/main.ts` | Phaser 게임 생성. 기준 해상도 **720×1280 세로**, `Scale.FIT` + `CENTER_BOTH`, 배경색은 `docs/art/style-guide.md`의 파스텔 톤에서 고른다 |
| `src/scenes/` | `BootScene` → `PreloadScene`(진행 막대) → `VillageScene`(빈 마을 자리: 배경색 + 가운데 "Abraxas" 텍스트 + 화면 탭 시 작은 반응) |
| `src/core/` | Phaser를 import하지 않는 순수 TS. 샘플로 `clamp(value, min, max)` 하나와 그 Vitest 테스트 |
| `src/narrative/`, `src/ui/`, `src/net/` | 빈 폴더 대신 각 폴더 역할을 한 줄로 적은 `README.md` |
| `client/scripts/check-size.mjs` | Node 표준 라이브러리만으로 `dist/` 전체 크기를 재고 10MB 초과 시 exit 1. 결과를 MB로 출력 |
| `client/README.md` | 로컬 실행·검사 방법 |

### 의존성 (이 버전 그대로, 추가 금지)

| 패키지 | 버전 | 종류 |
| --- | --- | --- |
| `phaser` | `4.2.1` | dependencies |
| `vite` | `8.3.5` | devDependencies |
| `typescript` | `7.0.2` | devDependencies |
| `vitest` | `5.0.5` | devDependencies |
| `@types/node` | `22.20.5` | devDependencies (check-size, vite.config용) |

`typescript 7.0.2`에서 `tsc`가 동작하지 않으면 멈추지 말고, 최종 요약에 오류 메시지를 그대로 적는다.

## 하지 말 것

- 위 표에 없는 패키지를 추가하지 않는다 (inkjs는 수직 슬라이스 작업에서 추가).
- 플레이어에게 보이는 텍스트에 축 이름·수치·'MBTI'를 넣지 않는다.
- localStorage 등에 게임 판정 값을 두지 않는다.
- `server/`, `content/`, 다른 브랜치는 건드리지 않는다.
- 외부 CDN 스크립트·폰트를 index.html에 넣지 않는다.

## 제출 전 셀프 체크

```
npm --prefix client install
npm --prefix client run typecheck
npm --prefix client test
npm --prefix client run build
npm --prefix client run check:size
npm --prefix client audit --omit=dev
```

모두 통과할 때까지 고친다. `package-lock.json`이 생기는지 확인한다(커밋 대상).

## 제출

1. 커밋은 검수자가 한다. 하지 않는다. push도 하지 않는다.
2. `docs/memory/status.md`의 '클라이언트 뼈대' 줄을 'T004 … 검수 대기'로 바꾸고, `docs/devlog/2026-10-31.md`에 작업 기록을 덧붙인다.
3. 마지막 응답에 만든 파일 목록과 셀프 체크 결과를 요약한다.
