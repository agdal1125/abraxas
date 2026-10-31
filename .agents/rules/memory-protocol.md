---
trigger: always_on
description: "에이전트 간 공유 메모리(docs/memory)와 개발 일지를 읽고 갱신하는 절차."
---

# 메모리 프로토콜

Claude Code와 Antigravity가 같은 기억을 쓰도록, 저장소 안의 `docs/memory/`를 유일한 원본으로 둔다. 각 도구의 자체 메모리(Antigravity brain, Claude 메모리)는 캐시로만 본다. 둘이 다르면 `docs/memory/`가 맞다.

## 작업 시작 시

1. `docs/memory/status.md`를 읽는다 (지금 어디까지 왔는지, 다음 할 일).
2. 작업 영역과 관련된 `docs/memory/decisions.md` 항목을 확인한다.
3. 비슷한 작업이 있었다면 `docs/memory/lessons.md`를 확인한다.

## 작업 끝날 때

| 무엇이 생겼나 | 어디에 쓰나 | 형식 |
| --- | --- | --- |
| 사람이 확정한 결정 | `decisions.md` | `- YYYY-MM-DD · 영역 · 결정 · 이유 · 출처` |
| 같은 함정을 다시 밟지 않을 교훈 | `lessons.md` | `- 영역 · 증상 → 원인 → 해결` |
| 진행 상태 변화 | `status.md` | 해당 줄을 고친다 (덧붙이지 않는다) |
| 오늘 한 일 | `docs/devlog/YYYY-MM-DD.md` | `devlog` 스킬 사용 |

## 쓰지 않는 것

- 에이전트의 추측, 제안했지만 사람이 고르지 않은 안.
- 비밀값, 개인정보, 토큰.
- 코드나 git 기록을 보면 알 수 있는 내용(파일 목록, 함수 설명).

## 크기 관리

- `decisions.md`가 200줄을 넘으면 오래된 항목을 영역별 ADR로 옮기고 한 줄 링크만 남긴다.
- `status.md`는 50줄 이하로 유지한다.
