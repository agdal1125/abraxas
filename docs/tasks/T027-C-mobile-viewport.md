# T027-C 가로 모드 주소창과 인트로 영상 버튼

먼저 `docs/tasks/T027-user-brief.md`를 읽는다. 담당·검수 메인 세션. 브랜치 `fix/mobile-viewport`.

## 사람의 말

"현재 핸드폰 가로 모드에서는 주소창 때문에 조작이 어려줘. 그리고 인트로 영상 버튼도 클릭이 잘 안돼."

## 원인

1. **전체 화면 요청이 한 번도 받아들여지지 않았다.** `main.ts`가 터치의 `pointerdown`에서 `requestFullscreen()`을 부르고 곧바로 리스너를 지웠다. 브라우저는 터치에 대해 손가락을 뗄 때(`pointerup`)에야 사용자 동작으로 인정한다. 요청은 거부되고 다시 시도하지 않아 주소창이 계속 남았다. 헤드리스 Chrome에서 터치 `pointerdown` 시점의 `navigator.userActivation`이 `isActive: false, hasBeenActive: false`인 것을 확인했다.
2. **인트로 영상의 버튼에 탭이 닿지 않았다.** 영상 화면(`.cinematic`)은 `pointer-events: none`인 게임 오버레이 안에 붙는데 이를 되돌리지 않았다. 실제 터치로 누르면 버튼 자리의 `elementFromPoint`가 캔버스나 뒤의 대사창이었다. E2E는 `element.click()`으로 눌러 이 문제를 잡지 못했다. 11월 8일에 같은 원인을 고친 #99가 병합되지 않은 채 남아 있었다.
3. **인트로 영상 화면이 보이는 영역보다 클 수 있었다.** `.cinematic`이 `position: fixed`와 `75vh`를 썼다. 폰에서 `vh`는 주소창이 숨은 때의 높이라, 주소창이 보이는 동안에는 버튼 줄이 화면 아래로 밀린다.

## 한 일

- `client/src/fullscreen.ts`: 터치를 뗄 때와 그 뒤의 `click`에서 전체 화면을 요청하고, 받아들여질 때까지 다시 시도한다. 전체 화면에 들어가면 화면 방향을 가로로 잠근다(지원하는 브라우저만). 플레이어가 일부러 나가면 더 조르지 않는다.
- 설정에 "전체 화면: 켜기/끄기"를 넣었다. Fullscreen API가 있는 브라우저에서만 보인다.
- `cinematic.css`: `pointer-events: auto`를 넣고, 화면을 게임 상자(보이는 뷰포트를 따라감) 안에 격자로 배치했다. 영상이 남는 높이를 쓰고 버튼 줄은 항상 안에 들어온다. 버튼을 48px 높이, 104px 이상 폭으로 키웠다.
- `style.css`: HUD나 대사창에서 시작한 드래그가 페이지를 밀거나 확대하지 않게 했다(`touch-action`, `overscroll-behavior`). 길게 눌러도 글자 선택·호출 메뉴가 뜨지 않게 했다. 결과 글과 입력칸은 선택할 수 있다.

## 확인

- 실제 터치 이벤트(CDP `Input.dispatchTouchEvent`, 헤드리스 Chrome 844×390과 844×330):

| 항목 | 전 | 후 |
| --- | --- | --- |
| 버튼 자리의 `elementFromPoint` | 캔버스 또는 대사창 | 버튼 |
| 소리 버튼 탭 | 반응 없음 | 켜짐 |
| 건너뛰기 탭 | 반응 없음 | 영상이 닫힘 |
| 버튼 높이 | 44px | 48px |

- `npm run typecheck`, `npm test`, `npm run build`, 한국어 E2E.
- 전체 화면 요청의 순서는 단위 테스트(`fullscreen.test.ts`)로 확인했다.

## 미확인

- **전체 화면이 실제로 켜지는지.** 헤드리스 Chrome은 사용자 동작이 있어도 전체 화면을 거부해(`TypeError: not granted`) 여기서 확인할 수 없다. Android 폰에서 첫 탭 뒤 주소창이 사라지는지 사람이 봐야 한다.
- **iPhone Safari.** iPhone에는 요소 전체 화면 API가 없다. 지금은 "홈 화면에 추가" 안내만 있다. 사람이 iPhone을 쓴다면 위로 쓸어 주소창을 접게 하는 방식을 따로 만들어야 하고, 실기기 없이는 맞출 수 없다.
- 카카오톡 인앱 브라우저.

## #99

같은 한 줄 수정이 이 작업에 들어 있다. 이 작업이 병합되면 #99는 닫는다.
