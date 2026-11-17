# 미니게임 스택(#103~#106 이식본) G1 검토

- 날짜: 2026-11-17
- 검토: 심리 자문(psychologist)
- 대상(아래 브랜치와의 diff로 봄):
  - `feat/minigames-v2` 736cddc (기준 origin/main 44caf0d)
  - `feat/shorter-errands-v2` 76a04b4 (기준 minigames-v2)
  - `feat/minigame-art-v2` 4f9821a (기준 shorter-errands-v2)
  - `feat/minigame-sound-v2` ed7782b (기준 minigame-art-v2)
- 읽은 것: 네 브랜치의 diff 전체. `client/src/core/minigames.ts`, `client/src/ui/minigames.ts`, `client/src/ui/sfx.ts`, `client/src/ui/game.ts`(모카 판, 주민 판, 반응 표시 흐름), `residents-errands.ts`, `resident-props.ts`의 setLumi·setEcho, 네 주민 errand JSON(ko·en)의 `game` 문구, `content/quests/*.json`의 단계 순서, `content/ink/{ko,en}/ep_or.ink`·`ep_lumi.ink`·`ep_echo.ink`·`ep_moka.ink`, `content/i18n/*/dialogue.json`의 lumi_04·moka_03·echo_04·or_02 반응, `content/scoring/items.json`의 근처 문항 축, 서버 `play.go`의 `auto_arrange`와 `EpisodeEnd.Hearts`
- 보지 않은 것: 실제 화면과 실제 폰 소리. `check:scoring`과 `check-dialogue`는 이번에 돌리지 않았다. 스택 전체에서 `content/scoring/`, `dialogue.json`, `items.json`은 바뀌지 않았다(diff --stat으로 확인). ink 변경은 `ep_or.ink`(ko·en)뿐이다.

## 판정: 수정 필요 (조건부 통과)

측정 수치, 문항 수, 측정 선택지 문구는 바뀌지 않는다. 미니게임 결과는 점수와 호감도에 들어가지 않는다. 배치 명령만 보내고, `Hearts`는 `Affinity / 20`이다. 측정 선택지에서는 소리가 나지 않는다. 그런데 두 미니게임이 바로 앞 C축 문항의 답을 무시하고 늘 '익숙한 쪽'을 하게 만든다. 이 둘을 고치면 통과다. 루미를 답에 따라 나눌지 중립으로 바꿀지는 사람이 정한다.

## 질문별 답

| 질문 | 답 | 근거 |
| --- | --- | --- |
| 미니게임 문구나 소리가 측정 문항 바로 앞뒤에서 플레이어를 평가하는 말로 읽히는가 | 아니다 | 오답 문구('순서가 달라요. 다시 보여 줄게요.', '조금 일러요. 한 번 더!')와 오답음은 판 안에서만 나온다. 판을 이기면(완료음 뒤 650ms) 또는 자동·닫기를 누르면 `world()`로 돌아간다. 다음 측정은 걸어가서 대상을 눌러야 열린다. 측정 문항이 실패 화면 바로 뒤에 오는 경로는 없다. 단계 잠금 때문에 다음 측정 전에는 반드시 성공하거나 자동으로 마친다 |
| 미니게임 결과가 측정 답에 대한 주민 반응 옆에 보이는가 | 아니다 | 반응 패널의 '다음'은 `world()`로 간다. 미니게임은 그 뒤 대상을 다시 눌러야 열린다. 모카는 같은 진열대를 누르므로 간격이 가장 짧지만(반응 → 탭 → '천천히 해도 돼' → 오븐) 한 화면에 함께 나오지는 않는다 |
| 성공과 실패가 주민 대사를 바꾸는가 | 아니다 | 미니게임 결과에 따라 갈리는 주민 대사는 없다. 판 뒤 대사('톱니도 맞았군', '진열이 끝났네. 고마워.', '정리하다가 오래된 이야기를 찾았어')는 자동으로 마쳐도 같다 |
| #104 단축이 측정 바로 앞뒤 줄을 바꾸는가 | or_02 뒤 한 줄만 바꾼다. 문제 없음 | 아래 표 |
| 측정 선택지는 조용한가 | 그렇다 | `sfx`를 부르는 곳은 `minigames.ts`뿐이다. client/src의 다른 오디오는 프렐류드 영상뿐이다. 첫 `pointerdown`에서 AudioContext를 열기만 하고 소리는 내지 않는다 |
| 솜씨나 속도를 성격 결과로 오해할 수 있는가 | 위험 낮음 | 화면에 점수가 없다. '1/3'은 진행 표시다. 결과와 하트는 선택으로만 정해진다. 다만 '정답도 없습니다' 안내 뒤에 정답이 있는 놀이가 나오므로, 플레이테스트에서 오해하는지 묻는다 |

### or_02 뒤 낚시꾼 줄 (ko·en, main 대비)

| | main | shorter-errands-v2 |
| --- | --- | --- |
| ko | 낚시꾼: 고운 모래는 저쪽 개울가에 있어. 상인도 길을 알 거야. | 낚시꾼: 고운 모래는 저쪽 개울가에 있어. 물가를 따라가 봐. |
| en | Angler: You'll find fine sand downstream. The merchant knows the way. | Angler: You'll find fine sand downstream. Follow the water. |

평가하는 말이 없고 ko와 en의 뜻이 같다. b(사람에게 묻기)만 상인을 한 번 더 들르던 비용이 사라져 a와 b의 수고가 같아졌다. P1과 P3 면에서는 나아진 것이다. b 선택지 문구는 '낚시꾼과 상인들'인데 상인이 말하지 않는 것은 경미한 불일치라 나중에 다룬다.

## 항목별 판정

| 브랜치 | 항목 | 판정 | 코드·심각도 | 근거 |
| --- | --- | --- | --- | --- |
| minigames-v2 + shorter-errands-v2 | 루미 리본 기억 게임 ↔ lumi_04(C축) | 수정 | P4, 높음 | 답이 a '창고의 익숙한 리본 장식'이든 b '솔방울과 잎으로 새로'든 '분홍 리본... 보라 리본'을 엮는다. #104가 재료 집기 분기(ribbon-source/field-source)를 없애서 b를 화면에서 보여 주는 곳이 하나도 없다 |
| minigames-v2 | 에코 서가 정렬 ↔ echo_04(C축) | 수정 | P4, 중간 | 답과 상관없이 번호 순서(=b '익숙한 서가 배치')로 되돌린다. en 'neat again'은 원래대로 돌아갔다는 뜻이고 ko에는 그 뜻이 없다. 3D 서가 배치는 답을 따르는데 미니게임만 따르지 않는다. 루미와 같은 방향이다 |
| minigames-v2 | 오르 톱니 ↔ or_03(D축, 퍼즐 뒤) | 문제 없음 | — | 판 뒤 '톱니도 맞았군'은 사실만 말하고 결과에 따라 바뀌지 않는다. 문항 상황('톱니바퀴 연결 퍼즐을 맞췄다')과 맞는다 |
| minigames-v2 | 모카 오븐 ↔ moka_03(D축)·moka_04(B축) | 문제 없음(경미 권고) | P2, 경미 | 이르거나 늦은 실패가 똑같이 다뤄져 위험 쪽 학습은 없다. moka_03 진열 높이를 보여 주던 것이 두 답에서 똑같이 빠졌고, '진열이 끝났네'가 굽기와 맞지 않는다 |
| minigames-v2 | 오답 문구와 완료 문구 | 문제 없음 | R3 | 사람을 평가하지 않고 놀이 상태만 말한다. 주민 목소리가 아니라 화자 없는 상태 줄이다 |
| minigames-v2 | 노출(축, 수치, 호감도, 'MBTI') | 문제 없음 | R6 | 'n/3'은 진행 수다. 점수와 시간을 보이지 않는다 |
| shorter-errands-v2 | 집기·돌아가기 단계 제거 | 문제 없음(루미 제외) | — | 지워진 ink knot은 or_merchant뿐이다. 측정 바로 앞뒤 대사는 바뀌지 않았다. lumi_06 악보 집기 분기와 echo 기록 집기 분기는 두 답에서 똑같이 빠진다. lumi_04 분기 제거는 리본 게임과 겹쳐 치우침이 된다(위 항목) |
| minigame-art-v2 | 그림 | 위 루미·에코 항목에 포함 | — | BOW 그림이 리본을 굳힌다. 오븐의 빵 색 변화는 이르고 늦음을 똑같이 보여 준다 |
| minigame-sound-v2 | 효과음, 설정 '소리' | 문제 없음(경미 권고) | — | 측정 선택지에서는 소리가 나지 않는다. 오답 버저(낮아지는 square)는 흔한 실패음이라 부드럽게 바꾸기를 권한다 |

## 수정 제안

### 1. 루미 리본 게임을 lumi_04 답에 맞춘다 (`feat/minigames-v2` 문구, `feat/minigame-art-v2` 그림)

| 키 | 현재 | 제안 ko | 제안 en |
| --- | --- | --- | --- |
| game.howto (두 답 공통) | 리본이 빛나는 순서를 기억했다가 그대로 눌러 주세요. / Remember the order the ribbons light up, then tap them back. | 장식이 빛나는 순서를 기억했다가 그대로 눌러 주세요. | Remember the order the decorations light up, then tap them back. |
| game.marks (lumi_04=a) | 분홍 리본, 노랑 리본, 민트 리본, 보라 리본 | 그대로 | 그대로 |
| game.marksField (lumi_04=b, 새 키) | — | 솔방울, 노란 잎, 초록 잎, 붉은 잎 | Pinecone, Yellow leaf, Green leaf, Red leaf |

b에서는 BOW 대신 솔방울 1개와 잎 3개 그림을 쓴다(갈색, 노랑, 초록, 빨강). 순서 길이, 시드, 음 높이, 판 수, 완료 문구는 그대로 둔다.
대안: 분기 없이 두 답에 같은 중립 장식을 쓴다. ko '분홍 장식, 노랑 장식, 초록 장식, 보라 장식' / en 'Pink charm, Yellow charm, Green charm, Purple charm'에 둥근 꼬리표 그림이다. 어느 쪽으로 할지는 사람이 정한다.

### 2. 에코 서가 문구를 중립으로 바꾼다 (`feat/minigames-v2`)

| 키 | 현재 ko | 현재 en | 제안 ko | 제안 en |
| --- | --- | --- | --- | --- |
| game.howto | 책 두 권을 차례로 눌러 자리를 바꾸고, 표식 순서대로 세워 주세요. | Tap two books to swap them until the marks run in order. | 책 두 권을 차례로 눌러 자리를 바꾸고, 정한 방식대로 붙여 둔 표식 순서에 맞춰 세워 주세요. | Tap two books to swap them until the marks for the arrangement you chose run in order. |
| game.cleared | 서가가 가지런해졌어요! | The shelf is neat again! | 책들이 정한 자리에 섰어요! | Every book is in the spot you chose! |

권고: echo_04=a이면 책등 색을 목표 위치별로 묶는다(Ⅰ·Ⅱ, Ⅲ·Ⅳ, Ⅴ). 그러면 다 맞춘 줄이 '색감으로 묶은 서가'로 보인다.

## 나중에 해도 되는 것

- 모카: 판을 마치면 구운 빵이 moka_03에서 고른 진열(1단/3단)에 놓이게 한다. 그러면 moka_share '진열이 끝났네'와 이어진다.
- or_02 b: 낚시꾼 줄에 상인을 넣는다. ko '낚시꾼: 고운 모래는 저쪽 개울가에 있어. 상인들도 그쪽으로 다녀. 물가를 따라가 봐.' / en 'Angler: You'll find fine sand downstream. The merchants go that way too. Follow the water.' 말할 상대가 없는 or-merchant 배우가 서 있는지는 QA에서 확인한다.
- `sfx.wrong()`을 triangle 파형의 부드러운 낮은 음으로 바꾼다.
- 리본 색 구분(분홍과 보라, 노랑과 민트)이 색각 차이 있는 사람에게 어려운지 플레이테스트에서 본다.
- 병합 브랜치에서 `npm run check:scoring`과 `node client/scripts/check-dialogue.mjs`를 다시 돌린다.

## 근거 등급

- 모든 판단은 문구, 단계 순서, 코드 경로를 읽고 한 추론이다. 근거 D. 플레이 데이터는 없다.
- '행동 결과가 선택과 어긋나면 뒤 문항 응답이 바뀐다'는 피드백 학습과 요구 특성(Orne, 1962, 미확인)에서 나온 개념적 추론이다. 이번에 원문을 읽지 않았다.
- 플레이어 화면에 효과를 주장하는 문구는 넣지 않았다. 그래서 문헌 확인을 하지 않았다.

## 외부 전문가에게 물을 질문

1. 강제선택 문항 뒤에 이어지는 행동이 고른 답과 반대일 때(b를 골랐는데 a를 하게 될 때), 같은 축의 뒤 문항 응답이 그 행동 쪽으로 옮겨 가는가. 그 효과를 잴 수 있을 만큼 크다고 볼 근거가 있는가.
2. 측정 문항 사이에 있는 짧은 솜씨 과제(기억 폭, 타이밍)의 실패와 좌절이 바로 뒤 자기 보고 응답의 기분 상태에 영향을 주는가. 자동 완료 버튼은 그 영향을 충분히 줄이는가.
3. 놀이형 성격 검사에서 정답이 있는 미니게임이 끼어 있으면 '선택에도 정답이 있다'는 믿음이 커지는가.

## 사람 결정이 필요한 항목

- 루미 미니게임을 lumi_04 답에 따라 나눌지(권장), 두 답 공통의 중립 장식으로 바꿀지 정한다.

## 재검 조건

- 수정 1·2가 반영된 브랜치에서 ko와 en 화면 캡처를 받는다. lumi_04 a와 b 각각의 리본 판, echo_04 a와 b 각각의 서가 판과 완료 문구가 필요하다.
- 미니게임 문구, 그림, 소리를 다시 바꾸거나 측정 문항 앞뒤의 단계를 다시 줄이면 이 기록을 기준으로 다시 검토한다.
