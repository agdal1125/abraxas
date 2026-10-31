# Abraxas Client

Phaser 4 + TypeScript + Vite 기반 모바일 세로형(720×1280) 웹 클라이언트.

## 사전 요구 사항

- Node.js 22 이상
  - macOS (Homebrew): `brew install node@22`
  - Windows (winget): `winget install OpenJS.NodeJS.LTS`

## 로컬 실행

저장소 루트에서 아래 명령으로 의존성을 설치하고 개발 서버를 띄운다.

```bash
npm --prefix client install
npm --prefix client run dev
```

## 검사 및 빌드

```bash
# 타입 검사
npm --prefix client run typecheck

# 단위 테스트 (Vitest)
npm --prefix client test

# 프로덕션 빌드
npm --prefix client run build

# 빌드 산출물 크기 검사 (10MB 이하)
npm --prefix client run check:size

# 프로덕션 의존성 보안 감사
npm --prefix client audit --omit=dev
```

## 폴더 구조

- `src/scenes/` — Phaser 씬 (`BootScene`, `PreloadScene`, `VillageScene` 등)
- `src/core/` — Phaser에 의존하지 않는 순수 TypeScript 게임 규칙 및 계산 로직
- `src/narrative/` — inkjs 대사 및 선택지 태그 연동
- `src/ui/` — 대사창, 선택지 버튼, 결과 카드 등 UI 구성 요소
- `src/net/` — 서버 API 통신 및 응답 검증
