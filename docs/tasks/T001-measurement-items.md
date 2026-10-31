# T001 측정 문항 설계

- 담당: 로컬 에이전트 (Antigravity CLI `agy`)
- 검수: Claude (`.agents/skills/design-review`)
- 승인: 사람
- 브랜치: `design/t001-measurement-items`

## 목표

38개 측정 문항과 4개 타이브레이커를, 30분 흐름 안의 어느 장면에서 어떤 선택으로 재는지 설계한다. 대사 전체를 쓰는 작업이 아니다. 장면 한 줄과 선택지 문구 초안까지만 쓴다(본 대사는 T002 ink 작업).

## 먼저 읽을 것

1. `.agents/rules/game-design-policy.md` — 수치 규칙 (위반 금지)
2. `docs/gdd/content-structure.md` — 흐름, 구간별 문항 수, NPC, 퀘스트 유형
3. `content/scoring/SCHEMA.md` — 데이터 형식

## 산출물

| 파일 | 내용 |
| --- | --- |
| `content/scoring/items.json` | 측정 문항 38 + 타이브레이커 4. `SCHEMA.md` 형식 |
| `content/scoring/npcs.json` | NPC 4명 스타팅 값(E 포함), 주제 축 |
| `docs/design/measurement-items.md` | 사람이 읽는 설계표: 구간 순서대로 한 행에 한 문항. 열: ID · 구간 · 종류 · 축 · 상황 · 선택지 a/b(/c) · NPC · 설계 의도 |
| `docs/design/measurement-rationale.md` | 축별로 8문항(E는 6)이 서로 다른 생활 장면을 재도록 어떻게 나눴는지, E 스타팅 값의 근거, 고민했지만 버린 안 |

## 배치 제약 (검증 스크립트가 검사함)

- 구간별 문항 수: prologue 3, 각 ep_* 6, 각 interlude_* 2, festival 5.
- 축별 문항 수: A·B·C·D 각 8, E 6.
- ep_* 문항은 그 NPC의 주제 축만, 주제 축 하나당 3문항 (루미 A·C, 모카 B·D, 에코 B·C, 오르 A·D).
- 그러면 NPC 없는 14문항(prologue + interlude + festival)에 A·B·C·D 각 2문항과 E 6문항이 들어간다.
- 역균형: 축별로 절반은 a 선택지가 + 극, 절반은 − 극 (주축 4/4, E 3/3).
- 가중치: 주 적재 ±8~15, 보조 적재 최대 1개 ±3~5.
- 딜레마 선택지에는 가치 태그 1~2개.

## 질적 기준 (검수자가 봄)

- 두 선택지 모두 '나도 저럴 것 같다'는 사람이 있어야 한다. 한쪽이 착하거나 똑똑해 보이면 실패.
- 선택지 문구에 축 이름, 성격 용어, 'MBTI'를 쓰지 않는다. 상황 속 행동으로만 쓴다.
- 같은 축의 8문항이 같은 상황을 반복하지 않는다(예: B축 8문항이 전부 '친구 감싸기'면 실패).
- NPC 장면에서 NPC가 선택 전에 자기 취향을 드러내 정답을 암시하지 않는다.
- 퍼즐 문항은 퍼즐 결과가 아니라 퍼즐 앞뒤의 태도를 묻는다.
- 공략 캐릭터를 성별로 부르지 않는다.

## 제출 전 셀프 체크

```bash
npm run check:scoring
```

오류 0개, 16유형 분포 경고 0개가 될 때까지 고친다. 경고를 그대로 두려면 이유를 `measurement-rationale.md`에 적는다.

## 제출

1. `design/t001-measurement-items` 브랜치에 커밋하고 push한다. main에 직접 커밋하지 않는다.
2. `docs/memory/status.md`의 해당 줄을 '검수 대기'로 바꾼다.
3. 사람에게 "T001 제출" 이라고 알린다. 검수 결과는 `docs/reviews/T001-review.md`로 돌아온다.
