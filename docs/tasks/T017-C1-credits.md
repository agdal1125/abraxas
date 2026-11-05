# T017-C1 게임 안 음악 출처 표기

담당: agy `gemini-4-argon-medium`. 검수: Claude. 커밋·push 금지.

사람 요청 원문:

> Merge all PR in the repository and carry on with the development.
> Use agy cli to delegate scenario writing and other straightforward tasks
> Proceed refining the 3js assets and character design.

## 문제

오프닝 영상 음악이 CC BY 3.0인데 게임 안에 표기가 없다(`client/public/cinematics/prelude-v1-credits.txt`, `docs/memory/status.md`의 '다음' 항목).

## 할 일

게임 안 설정 메뉴(`client/src/ui/game.ts`의 `settings()`)에 "만든 자료"(en: "Credits") 항목을 추가한다. 눌렀을 때 기존 메뉴 카드 패턴으로 다음을 보여 주고, 닫기(또는 뒤로)로 설정 메뉴로 돌아간다.

- 음악: "The Day We Smiled (60s Edit)", HoneyTune, Internet Archive, CC BY 3.0, 라이선스 링크 `http://creativecommons.org/licenses/by/3.0/`. 영상에 맞게 짧게 편집했다는 사실도 "60s Edit"라는 곡명으로 드러난다.
- 효과음: "효과음은 CC0 자료를 사용했습니다." 한 줄과, 전체 목록 `cinematics/prelude-v1-credits.txt`로 가는 링크.

CC0 효과음 작성자 이름은 표기 의무가 없고 이름 중 게임 화면에 맞지 않는 것이 있으니 화면에 나열하지 않는다. 원본 credits 파일은 수정하지 않는다.

## 지킬 것

- 한/영 문구는 기존 `this.ui.hud`가 읽는 곳에 함께 추가한다. 한글은 게임 말투에 맞춘다.
- 링크는 `target="_blank"`, `rel="noopener noreferrer"`. 키보드 포커스·48px 터치 크기·대비는 기존 메뉴 규칙을 따른다. 글자 크기 키움 설정에서 잘리지 않아야 한다.
- 가로 화면 740×360에서 카드가 넘치면 카드 안에서 스크롤되어야 한다. CSS가 필요하면 `client/src/ui/hud.css`에 최소로 추가한다.
- 저장 상태·측정·서버 호출은 건드리지 않는다. 새 의존성·새 추상화 금지.
- 핵심 동작만 테스트: 설정에서 크레딧을 열면 곡명·CC BY 링크가 보이고 돌아올 수 있다(`client/src/ui/game.test.ts`). 먼저 기존 테스트 패턴을 읽는다.

## 쓰기·셸

쓰기 디렉터리는 `client/src/ui`와 문구 파일이 있는 디렉터리뿐이다. 문구 파일이 허용 범위 밖이면 그 사실을 보고한다.

읽기는 내장 파일 도구로 한다. 셸은 다음 문자열만 쓰고 연산자(`&&`, `|`)는 쓰지 않는다.

- `npm --prefix client run typecheck`
- `npm --prefix client test`
- `npm --prefix client run build`
- `git status`
- `git diff --stat`

`docs/memory/`, `docs/devlog/`는 고치지 않는다.

## 결과 보고

바꾼 파일, 사용 모델과 한도 대체 여부, 실행한 검사와 결과, 미확인 항목, 사람에게 물을 질문.
