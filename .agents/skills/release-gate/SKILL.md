---
name: release-gate
description: 병합이나 마일스톤 완료를 선언하기 전에 Abraxas 게이트 G1~G5의 증거를 확인한다. PR 병합 전, 마일스톤 종료 때, 출시 판단 때 메인 세션이 쓴다.
---

# 릴리스 게이트

증거가 없으면 통과가 아니다. 실행하지 못한 검사는 `미실행`, 측정하지 않은 값은 `미측정`으로 쓴다. subagent 보고를 그대로 옮기지 않고 diff와 실행 결과를 직접 본다.

## 1. 어떤 게이트가 걸리는가

`git diff main...HEAD --stat`으로 판단한다. 게이트 정의는 `.agents/rules/delegation.md`에 있다.

| 바뀐 것 | 게이트 |
| --- | --- |
| `content/scoring`, `content/ink`, 대사, 반응, 결과 문구, 선택 앞뒤의 연출과 소리 | G1 |
| 에셋, 월드, 조명, 셰이더, 카메라 | G2, G3 |
| 렌더 코드, 로딩, 번들 | G3 |
| 플레이어가 겪는 흐름 | G4 |
| 정책 수치, 유형 이름, 비밀값, 배포, Firestore 규칙, 외부 서비스, 법적 판단 | G5 |

## 2. 공통 검사

```bash
npm --prefix client run typecheck
npm --prefix client test
go -C server vet ./...
go -C server test ./...
govulncheck -C server ./...
npm run check:scoring
```

렌더와 입력 변경은 `npm --prefix client run build`, `npm --prefix client run check:size`, 대상 화면 증거까지 본다. 콘텐츠 변경은 `node client/scripts/check-visible-names.mjs`, `node client/scripts/check-dialogue.mjs`를 돌린다. 흐름 변경은 `npm run e2e:play`를 돌리고 `run-summary.json`의 `reached`와 `errors`를 함께 본다.

## 3. 표 작성

```text
게이트 | 상태(통과/실패/미측정/해당 없음) | 증거 경로나 명령 출력 | 남은 위험
```

PR 설명이나 `docs/reviews/`에 남긴다.

## 4. 마일스톤 종료

- 비평 페르소나 5인의 새 보고서, 앞선 지적의 재발 여부
- 실제 사람 시험 결과. 없으면 마일스톤을 끝내지 않는다
- 실제 폰 측정. 없으면 미측정으로 적고 M2 이후에는 넘어가지 않는다
- `docs/memory/status.md`, `docs/devlog/` 갱신

## 5. 출시 판단(M5)

사람이 등급분류, 개인정보·약관, 운영 비밀값, 광고, 음악 출처를 확인했는지 묻고 답을 기록한다. 대신 판단하지 않는다. 배포는 사람이 승인한 뒤에만 한다.
