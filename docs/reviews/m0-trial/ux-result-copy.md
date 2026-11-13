# M0 시험: 결과·공유 문구 감사 (ux-designer)

2026-11-08 · 기준 #90 · 일반 subagent가 역할 파일과 `abraxas-ux-copy`를 읽고 수행. 화면 확인은 하지 않았다. 제안이며 적용하지 않았다. 메인이 `game.ts`의 `navigator.share({ text: copy.join("\n") })`를 직접 확인했다.

## 결론

'판정 근거 공유 제외'는 글자 그대로는 지킨다. 그러나 공유 텍스트에 링크가 없어 받는 사람이 게임으로 갈 수 없고, 카드 2·3 공유가 NPC 성향과 줄거리를 내보낸다. 고칠 때까지 공유 기능은 출시 조건을 못 채운다.

## 검사

`check-visible-names.mjs`, `check-dialogue.mjs` 통과. 앞의 검사는 i18n, ink, scoring만 읽고 'MBTI'를 찾지 않으며 `game.ts` 직접 글자와 조합된 공유문을 보지 않는다. 그 범위는 눈으로 읽었고 내부 코드, 수치, 'MBTI'는 없었다.

## 실제로 나가는 텍스트

코드로 조합한 예시다. 공유 실행은 하지 않았다.

- 카드 1: 껍질 너머의 나 / 처음의 나(서버 플레이만) / 오늘을 사는 / 사람들 속에서 힘이 나는 / 마음을 먼저 살피는 / 새로운 길에 끌리는 / 얻을 것을 보고 뛰어드는 / 내가 지킨 가치: 자율 · 성취 · 즐거움 / 고지문
- 카드 2: 루미 / 여전히 사람들 속에서 힘이 나는 사람이에요. / 새로운 길에 끌리는 마음이 더 깊어졌어요. / 닮은 점 / … / 다른 점 / … / 우리는 어떤 점에서 닮았을까?
- 카드 3: 마을 / 루미와 축제 준비 / 모카와 빵 나누기 / 에코와 책 정리 / 오르와 종 고치기 / 루미와 함께 걷는다

받는 사람에게는 게임 이름도 링크도 없는 조각 나열이다. 카드 2의 '우리'는 보낸 사람과 받는 사람으로 읽힌다.

카드 2의 `changes`는 NPC 주제 축의 시작 극을 드러내 기대 답변 방향이 샌다(오염 방지 5항의 취지). 위반 여부는 심리학자 확인이 필요하다.

## 수정 목록

| 위치 | 현재 | 제안 | 이유 |
| --- | --- | --- | --- |
| P0 `game.ts:588` | `navigator.share({ text: copy.join("\n") })` | 모든 카드에서 `{ title: "Abraxas", text: ui.result.share.text, url: 공개 링크 }` | 링크가 없다. 같은 버튼이 카드마다 다른 글을 보낸다 |
| P0 새 키 `result.share.text` | 없음 | ko "기억을 잃고 깨어난 마을에서 내 모습을 찾았어요. 당신은 어떤 사람일까요?" en "I woke up in a village with no memory and found out who I am. Who would you be?" | 궁금증과 링크만 보낸다. 유형 이름은 M2 확정 뒤 본다 |
| P0 `game.ts:583` 카드 2 공유 | NPC 이름, 변화, 닮은 점·다른 점, 고백 이유 질문 | 공유 본문에서 제외 | NPC 성향과 고백 상대가 새어 1회차가 오염된다 |
| P0 `game.ts:583` 카드 3 공유 | 심부름 4개, 동행 NPC | 공유 본문에서 제외 | 줄거리 스포일러 |
| P1 `game.ts:583` 카드 1 공유 | 네 줄, 가치, 고지 전체 | 공유 문구로 대체. 네 줄과 가치는 M2 세로 이미지에서 결정 | 글로는 읽히지 않는다 |
| P1 `game.ts:583, 590` | 카드 3 머리글 '마을 / 마을' | copy에서 `cards.village` 제거 | 같은 말이 두 번 나온다 |
| P1 `game.ts:583` `festival.companion` | 루미와 함께 걷는다 / Walk with Lumi | 새 키 `result.companion`: 루미와 함께 걸었어요 / Walked with Lumi | 선택지 문구 재사용. 영어는 명령문으로 읽힌다 |
| P1 `game.ts:579` | `tasks` ko·en 삼항 분기 | `result.tasks.*`로 이동 | 코드 안 글자 |
| P1 `game.ts:583` | 닮은 점/In common, 다른 점/Differences | `result.common`, `result.different`로 이동 | 코드 안 글자 |
| P1 ko `poles.B.minus`, `D.plus` | 사실과 원칙을 먼저 따지는 / 얻을 것을 보고 뛰어드는 | 사실과 원칙을 먼저 보는 / 얻을 것을 먼저 보는 | '따지는', '뛰어드는'이 상대 극보다 낮아 보인다. 심리학자 확인 |
| P1 ko `valueNames` | 보편, 박애, 자극 | 공정, 돌봄, 설렘 (키 유지) | 학술어 그대로다. 심리학자 확인 |
| P2 en `poles.B` | Checks the heart first / Checks the facts first | Listens to the heart first / Looks at the facts first | 직역이고 검진처럼 들린다 |
| P2 en `poles.D.plus` | Jumps in for what can be gained | Goes for what could be gained | 어색하고 경솔해 보인다 |
| P2 en `change` | More than ever: {from}. 등 | {from}, more than ever. / {from}, same as ever. / {from}, but starting to hear this too: {to}. / At first: {from}. Now leaning toward: {to}. | 틀에 끼운 티가 난다 |
| P2 en `cards.other`, `first` | The other / First Self | Them / Your first self | 타자화, 번역투 |
| P2 en `reflection.similar`, `unsure` | In what ways do we mirror each other? / What remains at the end of being drawn in? | Where are we alike? / What's left, after being drawn to them? | 직역 |
| P2 ko `moments.title` | 내가 고른 순간들 | 그렇게 본 순간 | 버튼 이름과 맞춘다 |
| P2 `ui.next` | 계속 (카드 2에서 '마지막 장면으로'와 나란히) | '그 사람 보기', '마을 보기' | 앞으로 가는 버튼 둘이 구별되지 않는다 |
| 명세 `game.ts:589` | 처음부터 다시, 확인 없이 실행 | `hud.confirm` 거치기 | 공유 바로 옆이라 오탭하면 결과를 떠난다 |
| 명세 `game.ts:605` | 끝 화면은 고지와 처음부터 다시뿐 | 공유, 결과 다시 보기 추가 | M2 끝 조건이 끝 화면 공유 의향이다 |
| 명세 `game.ts:588` | `navigator.share` 없으면 버튼이 사라짐 | 링크 복사 대체 | 그 환경에서는 공유 경로가 없다 |
| 명세 `game.ts:154` | `kind === "result"` 분기, 호출자 0 | 삭제 | 되살아나면 공유 규칙을 우회한다 |

## 미확인

740×360, 844×390, 큰 글자 20px, 제안 문구의 잘림, 실제 공유 시트, 카카오 인앱 동작.
