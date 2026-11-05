# T017-S1 시나리오 입구 문서 정리

담당: agy `gemini-4-argon-medium`. 검수: Claude. 커밋·push 금지.

사람 요청 원문:

> Merge all PR in the repository and carry on with the development.
> Use agy cli to delegate scenario writing and other straightforward tasks
> Proceed refining the 3js assets and character design.

## 문제

`docs/story/scenario.md`는 2026-11-02 기준이다. 그 뒤 `docs/story/chapters/`(T015)가 정본이 되었고 T016으로 게임에 이식되었다. 옛 문서에는 "마을 어귀에서 눈을 뜬 주인공"처럼 지금의 Prelude(하늘에서 떨어진 알, 하얀 주인공, 안내견 데미)와 어긋나는 내용이 남아 있다.

## 할 일

`docs/story/scenario.md` 한 파일만 다시 쓴다. 쓰기 전에 `docs/story/chapters/` 12개 파일과 `docs/reviews/T016-review.md`, `.agents/rules/game-design-policy.md`, `docs/tasks/T015-user-brief-scenario-chapters.md`를 모두 읽는다.

문서는 chapters로 들어가는 짧은 입구가 된다.

1. 이야기의 약속: chapters 기준으로 고쳐 쓴다.
2. 등장인물 표: 데미·우체부 포함. 화면 이름과 역할, 함께하는 일, 심부름 주민(화면 이름과 내부 ID).
3. 챕터 지도: 순서, 파일 링크, 한 줄 요약, 대략 시간. 에피소드 순서가 자유이고 막간이 완료 수에 따라 들어간다는 점을 지킨다.
4. 어느 문서가 정본인지: 대사·장면은 chapters와 게임 대사 파일이 정본이다.
5. 아직 정하지 않은 것: chapters가 일부러 비워 둔 내용만.

## 금지

- 대사를 이 문서에 복사하지 않는다. 새 설정·새 장면·새 대사를 만들지 않는다. 문서끼리 어긋나면 고치지 말고 결과 보고에 적는다.
- 측정 문항의 점수·방향·기대 답변을 쓰지 않는다. 문항 ID 언급도 chapters 링크로 대신한다.
- 성별이나 관계를 단정하는 호칭을 쓰지 않는다. 이 문서에는 필요한 경우가 아니면 'MBTI'라는 단어도 쓰지 않는다.
- 다른 파일은 고치지 않는다. 한국어로 쓰고 AI 번역투를 피한다. 길이는 옛 문서(190줄)보다 짧게.

## 쓰기·셸

`docs/story/scenario.md`만 쓴다(이 파일이 있는 `docs/story` 디렉터리가 허용되어 있어도 chapters는 읽기 전용). 읽기는 내장 파일 도구로 한다. 셸은 `git status`, `git diff --stat`만 쓴다.

## 결과 보고

바꾼 내용 요약, 문서끼리 어긋나서 찾은 곳, 사용 모델과 한도 대체 여부, 사람에게 물을 질문.
