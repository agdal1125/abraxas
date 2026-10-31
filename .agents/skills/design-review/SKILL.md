---
name: design-review
description: Reviews a submitted Abraxas design task (measurement items, scenario, scoring data) against the game design policy and writes a verdict report to docs/reviews. Use when a task branch is submitted for review, or the user says 검수, 리뷰, review T00N.
---

# 설계 검수

검수자는 설계를 다시 하지 않는다. 문제를 찾고, 이유와 고칠 방향을 적고, 판정을 내린다. 고치는 건 설계 담당이 한다.

## 1. 준비

- 제출 브랜치를 받는다: `git fetch origin <branch>` → `git switch <branch>`.
- 작업 지시서(`docs/tasks/T00N-*.md`)와 `.agents/rules/game-design-policy.md`를 다시 읽는다.
- `git diff main...HEAD --stat`으로 지시서에 없는 파일이 바뀌었는지 본다.

## 2. 기계 검사

```bash
npm run check:scoring
```

- 오류가 있으면 질적 검토 전에 '반려'로 판정하고 오류 목록만 돌려준다.
- 경고는 `measurement-rationale.md`에 이유가 적혀 있는지 확인한다.

## 3. 질적 검토 (문항마다)

| 코드 | 기준 | 심각도 |
| --- | --- | --- |
| Q1 정답 암시 | 한 선택지가 더 착하거나, 똑똑하거나, 어른스러워 보인다 | 높음 |
| Q2 축 혼입 | 의도한 축 말고 다른 축이 더 크게 갈린다 (예: B축 문항인데 실제로는 '혼자 vs 같이'가 갈림) | 높음 |
| Q3 NPC 암시 | NPC가 선택 전에 자기 취향을 드러낸다 | 높음 |
| Q4 금지 표현 | 축·성격 용어, 'MBTI', 성별 단정 호칭 | 높음 |
| Q5 장면 중복 | 같은 축의 문항들이 같은 생활 장면을 반복한다 | 중간 |
| Q6 퍼즐 측정 | 퍼즐 결과를 측정한다 | 중간 |
| Q7 극단 문구 | 선택지가 극단적이라 대부분이 한쪽만 고를 것 같다 | 중간 |
| Q8 맥락 부족 | 상황 한 줄만으로 무엇을 고르는지 이해되지 않는다 | 낮음 |
| Q9 톤 | 마을 분위기(귀엽고 따뜻함)와 어긋나는 문구, 번역투 | 낮음 |

Q1·Q2는 '이 선택지를 고를 사람이 어떤 사람인가'를 각 선택지마다 한 문장으로 적어 보고 판단한다. 두 문장이 의도한 축의 양 극으로 깔끔하게 갈리지 않으면 지적한다.

## 4. 전체 검토

- 30분 흐름 순서대로 읽을 때 같은 축이 연속으로 3번 이상 나오지 않는가.
- 에피소드마다 NPC 캐릭터성이 문항 상황에 드러나는가.
- E축 6문항이 '돈·시간·체력' 중 한 가지로 쏠리지 않는가.
- NPC E 스타팅 값의 근거가 캐릭터 설정과 맞는가.

## 5. 보고

`docs/reviews/T00N-review.md`에 쓴다. 제출 브랜치에 커밋한다(설계 파일은 고치지 않는다).

```markdown
# T00N 검수 · YYYY-MM-DD · 검수자: Claude

## 판정: 승인 | 조건부 승인 | 반려
(한 줄 이유)

## 기계 검사
- 오류 N · 경고 N (요약)

## 지적 사항
| # | 문항 | 코드 | 심각도 | 문제 | 고칠 방향 |
| --- | --- | --- | --- | --- | --- |

## 잘된 점
- (다음 작업에서도 유지할 것 1~3개)

## 사람이 결정할 것
- (검수자가 판단할 수 없는 기획 판단)
```

판정 기준: 높음 1개 이상 → 반려. 중간 3개 이상 → 조건부 승인. 그 외 → 승인 권고. 최종 승인은 사람이 한다.

## 6. 마무리

- 사람에게 판정과 높음 지적 개수만 짧게 알린다. 상세는 보고서에.
- 반복해서 나온 실수는 `docs/memory/lessons.md`에 한 줄 남긴다.
