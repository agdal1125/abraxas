---
trigger: glob
globs: "client/**/*.ts, client/**/*.json, client/vite.config.*"
description: "Three.js + TypeScript 클라이언트 코드 규칙 (ADR-0005로 Phaser에서 전환, 파일 이름은 유지)."
---

# 클라이언트 규칙 (Three.js + TypeScript)

- TypeScript `strict: true`. `any` 금지(불가피하면 이유 주석).
- 렌더링은 Three.js(ADR-0005). 모르는 API는 `node_modules/three` 타입 정의와 공식 문서로 확인한다. 대사·선택지·결과 UI는 HTML 오버레이.
- 3D 마을 구조와 형식: `docs/design/village-3d-contract.md`.
- 폴더:
  - `src/scenes/` 씬 (Boot, Preload, Village, Episode, Interlude, MemoryGate, Confession, Result)
  - `src/core/` 게임 규칙. 성향 계산, 호감도, 진행 상태. **Three.js·DOM을 import하지 않는 순수 TS**. Vitest로 테스트한다.
  - `src/narrative/` inkjs 연동. 대사·선택지 태그 해석.
  - `src/ui/` 대사창, 선택지 버튼, 결과 카드.
  - `src/net/` 서버 API 호출. 응답은 런타임 검증 후 사용.
- 성향 가중치는 `content/scoring/*.json`에서 읽는다. 코드에 숫자를 하드코딩하지 않는다.
- 상태 저장: 장면 단위로 서버에 선택 로그 전송 + 로컬 캐시. 선택은 저장 성공(또는 로컬 큐 적재) 후에만 반응 연출로 넘어간다.
- 초대권 수량을 localStorage 등 클라이언트 저장소에 두고 판정하지 않는다. 표시용 캐시만 허용.
- 에셋 로딩은 씬별 Preload. 초기 묶음 10MB 이하를 빌드에서 확인한다.
- 카카오톡·인스타그램 인앱 브라우저에서 동작해야 한다. 새 브라우저 API를 쓰면 대체 경로를 둔다.
- 공유 카드 이미지는 canvas로 만들어 Web Share API 또는 다운로드로 내보낸다.
