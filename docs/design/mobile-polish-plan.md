# 실기기 피드백 개선 계획

2026-11-01 · T013 / AS1 · 계획·디자인 산출물 · 제품 코드 변경 없음

**목표:** 처음 들어갈 때부터 안정적으로 보이는 마을에서, 기기 화면을 넓게 쓰고 가까운 대상을 직접 누르며 필요할 때만 이동 조작부를 표시한다.

**구현 기반:** 현행 Three.js 0.187.0 정사영 카메라·GLB·TypeScript·HTML UI를 유지한다. 렌더 준비, 표시 영역, 입력 소유권을 정리하며 새 프레임워크를 도입하지 않는다. 후속 구현은 아래 패키지별로 진행하고 Claude가 검수·통합한다.

**우선 근거:** [T013 사람 요청 원문](../tasks/T013-user-brief-mobile-polish.md). 기존 문서와 충돌하는 상시 패드·오른쪽 상호작용 버튼 지침은 이번 요청으로 대체한다. [측정 무결성 정책](../../.agents/rules/game-design-policy.md)의 수치는 바꾸지 않는다.

## 읽은 자료와 현재 확인 범위

- `AGENTS.md`, `.agents/rules/`의 8개 파일 전체, `docs/memory/status.md`, `decisions.md`, `lessons.md`.
- [꿈의 마을 계획](gameplay-dream-plan.md) 전체와 마지막 사람 결정, [T010](../tasks/T010-user-brief-gameplay-dream.md), [T011](../tasks/T011-landscape-brief.md) 전체.
- `client/index.html`, `src/main.ts`, `src/style.css`, `src/input/` 전체, `src/scenes/village.ts`, `dream-effects.ts`, `src/ui/game.ts`, `src/core/world/` 전체. 연결된 `ui/examine.test.ts`, 패키지 설정, 용량 검사 스크립트와 역할 ADR도 확인했다.
- 이번에는 정적 코드 조사와 공식 API 문서 확인만 했다. 화면 캡처·실기기 측정·개선 구현은 수행하지 않았다. T011의 과거 캡처 설명과 status의 과거 성능 수치는 이번 버전의 실측으로 재사용하지 않는다. T011에 링크된 영상·외부 게임·과거 첨부 이미지는 이번에 열어 보지 않았다.

## 공통 경계와 검수 초점

- 기존 가로 우선·세로 회전 안내·한국어/영어·글자 확대·키보드 조작을 보존한다. 터치 목표는 요청의 44px 이상보다 강한 기존 정책에 맞춰 **48×48 CSS px 이상**으로 한다.
- 성향 수치·38개 측정 문항·별도 4개 타이브레이커·가중치·문항 순서·초대권 수치 변경 없음. 선택지의 모양·강조·순서를 바꾸지 않는다. 이동·탭·살펴보기는 측정 사건을 만들지 않는다.
- `Game.choose()`·`save()`는 현재 로컬 저장이며 오류를 무시한다. 서버 저장이 완료된 것처럼 기술하지 않는다. 서버 확정·복구는 다음 안건의 선행 작업이다. 이번 입력 변경이 기존 선택 확정과 `panel()`의 token 중복 방지를 깨면 안 된다.
- 실제 위험: 로딩 중 시작 입력, 실패한 전체 화면 요청, 회전 뒤 붙잡힌 이동 입력, 두 손가락·드래그 뒤 잘못된 탭, 가까운 대상끼리 겹침, 모델이 없는 진행 지점 누락. 각각 아래 검증에 포함한다.
- 새 저장소 도구가 필요하면 Node `scripts/*.mjs`로 만든다. 점수 fixture·콘텐츠·서버 API·외부 의존성은 이번 쓰기 범위에 넣지 않는다.

## 1. 처음 들어갈 때 화면이 버벅임

### 원인 진단: 확인된 구조와 아직 검증할 가설

| 코드 근거 | 확인된 사실 | 측정할 가설 |
| --- | --- | --- |
| `Village.constructor()`, `tick()` | 로딩 완료 전부터 RAF와 `renderer.render()`가 돈다. `Promise.all(loading)`은 모델 준비만 기다린 뒤 `ready=true`로 바꾼다 | 메시가 순차적으로 추가될 때 셰이더 컴파일·버퍼/텍스처 업로드가 노출된 프레임에 몰릴 수 있다 |
| `Village.load()`, `place()`, `character()` | 모델별 Promise 캐시는 있으나 모든 배치를 복제·traverse한다. Draco worker는 1개, 캐릭터는 skeleton 복제·mixer·접지 텍스처를 만든다 | GLB 전송·파싱·Draco 디코드·메인 스레드 객체 생성이 초기 지연을 나눠 만들 수 있다 |
| `Village.ground()` | 지형 존재 확인 fetch 뒤 `place()`에서 같은 경로를 loader로 요청한다 | 브라우저 캐시 여부에 따라 확인 요청·재파싱 비용이 생길 수 있다. 네트워크 중복 전송이라고 단정하지 않는다 |
| `Village.resize()`, `tick()` | 모바일 그림자 1024, 그 외 2048. DPR 상한 1.5/2. 광원은 매 프레임 플레이어를 따라간다 | 첫 shadow render target 할당과 그림자 패스, 넓어진 시야의 draw call이 비쌀 수 있다 |
| `DreamEffects.constructor()` | `TextureLoader.load()`의 완료는 Village의 loading Promise에 포함되지 않는다 | 준비 완료 뒤 효과 이미지 업로드가 남을 수 있다 |
| `Game.constructor()`, `main.ts` | Village 생성 직후 Game을 만들고 타이틀 또는 저장된 구간을 연다 | 화면 준비 전 UI가 먼저 활성화돼 버벅이는 구간을 사용자가 보게 된다 |
| `Village.findNearby()`, `core/world/move.ts:step()` | 근접 검색에서 배열·가림 검사를 반복하고 이동 때마다 `boundaries()`·box edge를 계산한다 | 첫 이동과 계속 걷기의 CPU 비용. 초기 컴파일 문제와 분리해 trace로 확인한다 |

**현재 원인 확정은 하지 않는다.** 기존 예산이나 과거 FCP만으로 이번 휴대폰의 초기 프레임 문제를 설명할 수 없다.

### 해결 방식

1. 처음에는 기존 색감의 가벼운 DOM 로딩 화면을 표시한다. 모델·필수 효과 텍스처 완료 → 최초 카메라/광원 확정 → 셰이더 사전 컴파일 → 로딩막 뒤 실제 렌더 → 다음 RAF → 준비 완료 순서로 연다. 준비 전 게임 시작·이동·상호작용은 차단한다.
2. `renderer.compileAsync(scene, camera)`를 우선 검토하고 설치 버전의 타입/구현으로 확인한다. 동기 `renderer.compile(scene, camera)`를 사용해야 하는 경우에도 로딩막 뒤에서 수행한다. 컴파일 전에 조명과 환경을 설정해야 하며, 이 호출만으로 디코드·텍스처 업로드·그림자 첫 렌더까지 완료됐다고 간주하지 않는다. [Three.js 공식 문서](https://threejs.org/docs/pages/WebGLRenderer.html)
3. 로딩막 뒤 첫 실제 렌더로 그림자와 재질 사용을 준비하고, 준비 완료 후 180ms 페이드를 제안한다. 움직임 줄이기 설정이면 즉시 전환한다. 고정 시간 대기만으로 준비를 추정하거나 일정 시간 뒤 실패를 성공으로 바꾸지 않는다. 기존 실패 안내를 유지한다.
4. 먼저 현행 모바일 1024를 기준 측정한다. 부족한 기기에서 512와 비교하고, 데스크톱 2048도 필요한지 확인한다. 그림자 수신·접지 품질과 비용을 함께 보고 결정한다. status의 ‘그림자 해상도 상향’을 무조건 실행하지 않는다. 터치 가능 여부만으로 GPU 성능을 추정하지 않는다.
5. trace가 지형 중복 요청·객체 생성·이동 계산 중 하나를 지목할 때만 해당 경로를 줄인다. 초기부터 전면 인스턴싱·worker 확대·물리 엔진 교체를 하지 않는다. 정적 맵 경계 캐시는 `step()`이 병목으로 확인되면 P-A 안에서 검토하며 기존 충돌 검증을 그대로 통과해야 한다.

**바꿀 파일:** P-A의 `village.ts`, `dream-effects.ts`; P-B의 `main.ts`, `style.css`. 성능 근거가 있을 때만 P-A의 `core/world/move.ts`, `move.test.ts`.

### 측정과 완료 기준

- `performance.mark/measure`로 진입·GLB 준비·효과 텍스처 준비·compile 종료·첫 실제 render·조작 허용 시점을 기록한다. `loadAsync` 전체 시간을 디코드 시간이라고 부르지 않고, 네트워크와 worker/메인 스레드 trace를 함께 본다.
- `tick()`의 시뮬레이션용 dt는 50ms로 잘리므로 성능 지표에 쓰지 않는다. clamp 전 RAF 간격을 수집한다. 초기 진입부터 조작 후 5초까지와 60초 걷기 구간을 분리해 p50/p95/최대·50ms 초과 프레임 수·지원 환경의 long task·draw call·초기 전송량을 기록한다.
- 같은 배포 빌드·기기·브라우저·경로에서 cold/warm 각각 5회 전후 비교한다. 기기명·OS·브라우저·화면 크기·DPR·캐시 조건·Wi-Fi/LAN·발열 조건을 적는다. JS render 호출 시간은 GPU 완료 시간과 구분한다.
- **제안 합격선:** 모델/효과가 빠진 프레임과 준비 전 입력 수락 0건. 대표 실기기에서 조작 직후 5초와 60초 걷기 각각 p95 RAF 간격 33.3ms 이하를 목표로 하며, 로딩막을 걷은 뒤 자산 준비 때문에 생기는 100ms 초과 멈춤 0건. 아직 달성값이 아니다. 초기 조작 가능 시간도 전후 실측해 로딩막으로 긴 대기를 숨기지 않았는지 함께 판정한다.
- 초기 로딩 묶음 10MB 이하 확인. 현행 `check:size`는 전체 dist를 10×1024×1024 bytes와 비교하므로, 실제 최초 요청 전송량과 따로 보고한다. 헤드리스 GPU/CPU 결과는 휴대폰 FPS로 보고하지 않는다.

## 2. 꽃잎·눈처럼 보이는 효과가 화면에 붙어 보임

### 원인 진단

`DreamEffects.update()`는 각 입자의 x/z를 매 프레임 `player.x/z + ...`로 다시 계산한다. 카메라가 플레이어를 따라가는 동안 입자도 함께 평행 이동하므로 화면 위 오염처럼 보일 수 있다. 이미 scene의 `THREE.Points`이지만 좌표 갱신이 월드 고정을 깨고 있다. `sizeAttenuation:false`의 일정한 화면 크기도 그 인상을 강화할 수 있다.

현재 코드의 움직이는 효과는 `petal`·`firefly`이며 별도 snow 효과나 눈 텍스처는 없다. 사람의 ‘눈’은 화면에서 본 표현으로 존중하되 새 계절/눈 기능을 추가하지 않는다. mist와 glow는 이미 호수·소품 좌표에 놓여 있으므로 그 위치는 유지한다.

### 해결 방식

- 각 입자의 위치·속도·수명을 생성 시 월드 좌표로 저장한다. 이후에는 `position += velocity × dt`와 작은 흔들림만 적용하고 플레이어 이동량을 더하지 않는다. 카메라/플레이어 자식으로 붙이지 않는다.
- 카메라 주변의 지면 투영 영역에 여유를 둔 방출 범위를 계산한다. **카메라는 새로 태어날 위치만 옮긴다.** 기존 입자는 수명이 끝나거나 시야와 여유 범위를 벗어났을 때 화면 밖에서 재배치한다. 화면 안 전체 입자를 함께 재중심화하지 않는다. 회전·줌 변경에서도 보이는 입자의 월드 좌표를 유지한다.
- 꽃잎은 꽃밭 주변, 반딧불은 물가·그늘 주변의 기존 배치와 연관 짓는다. 방출 구역을 벗어나면 억지로 화면을 채우지 않는다. 정사영에서는 원근 크기 변화가 없으므로 `sizeAttenuation` 전환만으로 해결했다고 하지 않는다. 지형/건물에 가려지는 깊이 검사와 화면상의 이동을 함께 확인한다.
- 기존 PNG를 재사용한다. 동시 이동 입자는 총 24개 이하를 첫 제안 상한으로 하고 실기기에서 줄일 수 있다. 빛·안개 밀도를 늘려 빈 화면을 메우지 않는다. 움직임 줄이기에서는 이동 입자를 숨겨 재배치 튐도 보이지 않게 한다.

**바꿀 파일:** `client/src/scenes/dream-effects.ts`, `village.ts`; 필요한 회귀 검증 `dream-effects.test.ts`(신규).

**완료 기준·검증:** 입자 시뮬레이션을 고정한 상태로 카메라만 이동하면 화면 좌표는 변하고 입자 월드 좌표는 같아야 한다. 같은 카메라에서 dt를 진행하면 입자 자체만 이동한다. 시야 안 입자 집단 점프 0건, 화면 전체 고정 얼룩 0건, 대사·대상 가림 없는 밀도를 6개 해상도의 정지 화면과 10초 이동 영상으로 확인한다. 순수 위치 계산/재배치 조건에 작은 테스트를 두되 새 엔진을 만들지 않는다.

## 3. 주소창을 줄이고 기기마다 화면을 꽉 채움

### 원인 진단

현재 `main.ts:updateViewport()`는 visualViewport 크기·offset으로 app을 배치한다. `Village.resize()`는 실제 w/h, `tick()`은 그 비율로 카메라 좌우를 계산한다. HTML/CSS에서도 16:9 고정 프레임은 찾지 못했다. 따라서 사람의 잘림 증상을 확인하되 **고정 비율 코드가 존재한다고 단정하지 않는다.** 주소창이 차지하는 영역, app/canvas rect 불일치, safe-area의 배경 처리, 지나친 카메라 확대, 리사이즈 직후 카메라 보간을 각각 확인해야 한다.

`viewport-fit=cover`와 UI safe-area padding은 이미 있다. 반면 전체 화면 요청·manifest 연결·100dvh 기본값은 없다. `viewHalfHeight`의 높이 비례 보정은 h≥390에서 인물 크기를 유지하려는 구조이나 실제 인물 높이는 아직 측정하지 않았다.

### 주소창과 전체 화면

| 방법 | 구현 제안 | 한계·대체 경로 |
| --- | --- | --- |
| Fullscreen API | 명시적인 ‘전체 화면’ 버튼의 사용자 클릭 안에서 `document.documentElement.requestFullscreen()` 호출. `document.fullscreenEnabled`와 메서드 확인, Promise 실패 처리. `fullscreenchange` 뒤 표시 영역 재계산 | 자동 진입을 보장할 수 없다. 회전 이벤트만으로 요청하지 않는다. 거절·Esc·시스템 종료 후에도 진행 유지. 전체 루트를 대상으로 해야 app 밖의 회전 안내도 보인다 |
| iPhone Safari | 요소 전체 화면을 필수 조건으로 삼지 않는다. 미지원 시 홈 화면 추가 안내를 접을 수 있게 제공 | iPad 지원을 iPhone에 일반화하지 않는다. 비디오 전용 전체 화면은 HTML 게임 대안이 아니다. 실제 OS/브라우저에서 기능 확인 |
| PWA manifest | 신규 manifest의 `display: fullscreen`을 선언하고 미지원 시 표준 fallback인 `standalone` 경로를 허용. 앱 이름·scope·start_url·기존 아트 기반 아이콘 설정 | 설치/홈 화면 실행 때 적용되며 현재 열린 일반 탭 주소창을 없애지는 않는다. iOS에서는 standalone과 상태 표시줄·안전 영역을 실기기로 확인. 오프라인 캐시·서비스 worker는 이번 범위에 추가하지 않음 |
| 100dvh | `height:100vh` 뒤 `height:100dvh` 기본값, JS 측정값과 한 경로로 연결 | 동적 viewport 높이에 맞추는 기능이지 주소창 숨김 API가 아니다 |
| viewport-fit·safe-area | 기존 cover 유지. 월드 배경은 가장자리까지, 중요한 UI/조작 중심만 `env(safe-area-inset-*)` 안쪽에 배치 | 월드 전체를 안전 영역 안으로 축소해 양옆 띠를 만드는 방식은 피한다. 노치와 홈 표시기는 브라우저/OS 제어 영역 |

Fullscreen API의 사용자 활성화와 거절 처리는 [WHATWG 표준](https://fullscreen.spec.whatwg.org/)을 따른다. Safari 16.4의 요소 전체 화면 발표 대상은 macOS·iPadOS이며, iPhone 제약은 [WebKit 발표](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)와 [WebKit 이슈 206854](https://bugs.webkit.org/show_bug.cgi?id=206854)를 확인했다. [Manifest 표준](https://www.w3.org/TR/appmanifest/#display-member)의 fallback, [WebKit 동적 viewport 단위](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/), [cover와 safe-area 설명](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)을 근거로 한다. 2026-11-01 조사이며 기기별 실행 결과는 아니다.

### 화면비와 캐릭터 크기

- `updateViewport()`가 정한 app 표시 영역을 renderer·UI·입력의 공통 기준으로 삼는다. CSS aspect-ratio 제한·가운데 16:9 틀·object-fit crop·가로 늘이기를 추가하지 않는다. 주소창 열림/닫힘, 회전, fullscreenchange를 한 번의 RAF 갱신으로 모아 중복 resize를 줄인다.
- 정사영 좌우는 `left=-halfHeight×(w/h)`, `right=+halfHeight×(w/h)`, 상하는 `±halfHeight`. 늘어난 폭은 더 넓은 월드를 보여준다. 물리 화면 해상도가 아니라 **실제 canvas CSS 표시 영역**을 사용한다.
- 탐색 시 같은 기본 포즈의 주인공 머리끝~발끝 투영 높이를 **60~80 CSS px**, 중심 목표 70px로 잡는다. 모델 bounding box 투영으로 측정해 기존 halfHeight를 `현재 투영 높이/70` 비율로 보정하거나 동등한 산식을 사용한다. h만 줄었을 때 390 기준 하한 때문에 인물이 작아지는지 함께 확인한다. 그림자·느낌표·머리 위 장식은 측정에 넣지 않는다.
- 최초 프레임과 resize 시 `cameraHalfHeight`도 새 화면 기준으로 맞춘다. 대화 확대는 따로 유지하되 두 인물/대상이 패널 위에서 보이게 한다. 폭이 긴 기기라고 캐릭터를 작게 만들어 섬 전체를 넣지 않는다.

**바꿀 파일:** P-B의 `client/index.html`, `main.ts`, `style.css`, 신규 `client/public/manifest.webmanifest`; P-A의 `village.ts`; 아이콘은 아래 조건부 아트 범위.

**완료 기준·검증:** 6개 가로 viewport에서 app과 canvas의 표시 rect 차이 1 CSS px 이하, 게임이 만든 좌우/상하 여백·잘린 조작부 0건. 탐색 캐릭터 높이 60~80px. 노치 안쪽에 48px 목표가 온전히 남고 긴 대사·3개 선택지·글자 확대가 스크롤로 모두 읽힌다. 전체 화면 성공·거절·종료, 주소창 열림/닫힘, 390×844 세로 전환 후 복귀에서 위치·대화·선택 로그 유지 및 입력 0으로 초기화. 홈 화면 실행과 인앱 미지원 경로는 실기기에서 별도 확인한다.

**해상도 주의:** 요청한 915×412는 약 20:9 이상이지만 932×430은 약 19.5:9다. 둘 다 검사하고, 명확한 추가 긴 화면 960×432(20:9)도 검사한다. ‘모든 기기 꽉 채움’은 웹에 허용된 표시 영역 기준이며 iPhone 일반 탭 주소창 제거를 합격 조건으로 약속하지 않는다.

## 4. 살펴보기·말하기 버튼을 없애고 가까운 대상을 직접 탭

### 원인 진단

`Controls`는 `.talk-button` 하나의 문구를 말하기/살펴보기로 바꾼다. `Village.tap()`은 캐릭터 모델만 raycast하고 맞은 ID가 `findNearby()`의 단일 최근접 대상과 같을 때만 실행한다. 사물은 `place()`의 Object3D 참조를 보관하지 않으며 탭 검사에 없다. 모델이 없는 lake/plaza/gate도 제외되어 있다. `interactNearby()`는 대상을 다시 찾으므로 범위 내의 다른 대상을 정확히 누르는 동작을 표현하지 못한다.

### 해결 방식

- `.talk-button` DOM·이벤트·버튼용 문구와 관련 CSS를 제거한다. 감상 콘텐츠와 `examine:` 내부 라우팅은 유지한다. 대사 넘기기·측정 선택지 버튼은 제거 대상이 아니다.
- 월드에서 실제 맞힌 **대상 ID**를 `interactTarget(id)`로 넘기고, 그 메서드가 ready/enabled·거리·가림·현재 진행 상태를 다시 확인한 후 기존 `onInteract`로 한 번만 보낸다. `interactNearby()`는 키보드용 현재 포커스를 같은 검증 경로에 넘긴다. 최근접 NPC가 따로 있어도 범위 안 사물을 직접 누르면 그 사물이 열린다.
- `place()`에서 상호작용 가능한 배치의 object/ID와 시각 bounds만 보관한다. 캐릭터·꽃/나무/우물·안내판은 실제 메시 raycast를 우선하고, 작은 물체는 투영한 시각 bounds를 최소 48×48px로 확장한 화면 hit 영역으로 보완한다. 충돌용 크기를 손가락 영역으로 키우지 않는다.
- lake/plaza/gate는 현재 진행 가능한 때만 기존 위치에 표식을 두고 48px 투영 hit 영역을 제공한다. 이 경로가 없으면 막간·축제·기억의 문 진입이 막힌다. 큰 나무/우물은 현재 `nearest()`처럼 충돌 외곽 거리로 판정한다.
- 기본 거리 0.85 월드 단위를 유지한다. 기존 0.1 여유는 포커스 깜빡임 방지에만 쓰고 실행 시에는 다시 0.85 이내인지 확인한다. player→대상 충돌 가림은 `visible()` 검사를 재사용하고, camera→대상 시각 가림도 검사해 건물 뒤를 관통해 누르지 못하게 한다.
- 화면 영역이 겹치면 실제 메시 hit를 먼저, 확대 영역끼리는 화면상의 가까운 중심·앞쪽 깊이·안정된 ID 순으로 하나만 고른다. 같은 자리의 진행 지점/인물은 기존 진행 가능 대상 우선 규칙을 보존한다. 이것으로 측정 선택지 자체에 우선순위를 만들지 않는다.
- 탭은 같은 pointer의 down/up, 이동 10 CSS px 이하인 경우로 제안한다. pointercancel·조이스틱 소유·대화 위 입력·오래된 화면 token은 제외한다. 한 입력이 조이스틱 이동과 상호작용, 대화 닫기와 재열기를 동시에 만들지 못하게 한다.
- 범위 밖 탭은 자동 이동 여부를 마지막 질문으로 남긴다. **추천안은 이동하지 않고 ‘조금 더 가까이 가 보세요’만 짧게 표시**하는 것이다. 자동 이동은 경로 탐색·장애물·취소 동작까지 필요한 별도 범위이며 승인 전 넣지 않는다.
- 가까운 대상에는 발밑의 작은 중립 링 또는 약한 테두리를 표시한다. 키보드 포커스 한 대상만 한 단계 더 또렷하게 하고, 상태 문구로 안내한다. 하트·성향 암시·정답색은 쓰지 않는다. 지도 전체에 상시 이름표를 붙이지 않는다.
- 키보드는 WASD/방향키와 **기존 Space/Enter를 유지하고 E를 추가**하는 안을 제안한다. 현재 E는 구현되어 있지 않다. 입력 요소·대사 버튼에 focus가 있으면 월드 키 처리하지 않는다. 새 talk 버튼 대신 근접 상태 안내를 `role=status`로 제공하고 대상 진입/변경 때만 읽게 한다. 세부 결정은 마지막 질문에 둔다.

**바꿀 파일:** P-A의 `village.ts`, `core/world/nearby.ts` 및 관련 회귀 테스트; P-C의 `input/controls.ts`, `movement.ts`, `controls.test.ts`, `ui/game.ts`, `ui/examine.test.ts`; P-B의 `style.css`. 새 화면 안내가 필요하면 P-C가 `content/i18n/ko/ui.json`, `en/ui.json`을 함께 수정한다.

**완료 기준·검증:** 말하기/살펴보기 조작 버튼 0개. NPC·사물·안내판·모델 없는 진행 지점 각각 0.85 안/밖, 벽 앞/뒤, 중첩 영역, canvas 가장자리 탭을 검증한다. 같은 지점에서 최근접 NPC 옆 사물을 눌러 해당 사물만 열리는 회귀 검사, 같은 탭 1회당 상호작용 최대 1회, 살펴보기 전후 선택 로그·진행 변화 0건. 실제 터치/CDP 좌표로 검사하며 dev 훅 호출만으로 탭 검증을 대신하지 않는다. 최소 hit 영역은 6개 크기·렌더 DPR 1/1.5/2에서 CSS px로 확인한다.

## 5. 왼쪽 아래를 누를 때만 이동 조작부 표시

### 원인 진단

`Controls.setActive(true)`는 pad를 포함한 root를 표시하고 `movePad()`는 고정 rect의 중심을 기준으로 방향을 정한다. CSS의 최종 입력 영역은 120px, 보이는 원은 96px이며 `✥`가 상시 표시된다. 손을 떼도 원판이 남는다.

### 제안 플로우

1. 탐색 대기: 방향 화살표·원·스틱을 모두 숨긴다. 최초 한 번 ‘왼쪽 아래를 누른 채 움직여 보세요’라는 짧은 문구를 제공하고 첫 이동 뒤 지운다. 키보드 입력만으로 모바일 패드가 나타나지 않는다.
2. app의 **왼쪽 45%, 아래쪽 45%** 안에서 시작한 touch/pen pointer를 이동 후보로 잡는다. 안전 영역 밖 OS 제스처를 강제로 가로채지 않는다. DOM 대화·선택지·전체 화면 버튼은 우선 제외한다.
3. 손가락 위치에 96px 원판과 36px 손잡이를 표시한다. 원판 불투명도 0.28, 손잡이 0.50, 테두리 0.45를 출발안으로 한다. 원판 가장자리가 safe-area 밖이면 시각 중심만 48px 안쪽으로 제한하고 입력 원점은 최초 손가락 좌표를 유지해 누르는 순간 이동하지 않게 한다.
4. 기존 8방향 판정과 대각선 속도 제한을 유지한다. 최초 원점에서 14px 이내는 정지, 밖은 이동. 최대 시각 손잡이 이동 32px. 손가락이 영역을 나가도 capture한 pointer 하나로만 계속 조작한다.
5. 왼쪽 아래의 상호작용 대상도 누를 수 있어야 한다. 시작 위치가 대상의 hit 영역이면 이동 임계값 전까지 탭 후보를 보존하고, 짧게 떼면 상호작용만 실행한다. 14px를 넘겨 드래그하면 조이스틱이 소유하고 손을 떼도 상호작용하지 않는다. 다른 손가락의 월드 탭은 이동 pointer가 살아 있는 동안 무시한다.
6. pointerup 즉시 이동 0, 원판은 120ms 안에 사라진다. pointercancel·lostpointercapture·blur·hidden·회전·대화/결과 진입에서는 이동과 표시를 즉시 해제한다. 움직임 줄이기에서는 페이드 없이 숨긴다. 다시 누르면 새 위치에서 시작한다.

**바꿀 파일:** P-C의 `input/controls.ts`, `movement.ts`, `controls.test.ts`, `input.test.ts`, `ui/game.ts`; P-B의 `style.css`; P-A의 `village.ts` 탭 후보/소유권 연결. 새 조이스틱 이미지는 필요 없고 CSS 원 두 개를 재사용한다.

**완료 기준·검증:** 대기 캡처에서 조작 그림 0개, 서로 다른 시작점 세 곳에서 원이 새로 생성됨, release 뒤 즉시 이동 0·120ms 뒤 잔상 0. 회전·알림/앱 전환·두 손가락·패드 밖 release·대화 전환을 각 10회 반복해 이동 고착과 잘못된 상호작용 0건. 740×360과 긴 화면에서도 대상 탭과 이동 후보 판정이 같아야 한다.

## 구현 패키지와 연결 계약

계획·디자인은 Codex `gpt-6-astra` reasoning `high`, 아래 실제 구현은 모두 **agy Argon4 (`gemini-4-argon-medium`)** 담당이다. agy 한도 도달 시 같은 범위를 Codex `gpt-6.1-terra`에 넘기고 결과에 대체 사실을 적는다. 각 패키지는 별도 worktree/PR, 쓰기 범위는 겹치지 않는다.

| 패키지 | 독점 쓰기 범위 | 완료 기준 |
| --- | --- | --- |
| P-A 렌더 준비·월드 입자·카메라·월드 탭 판정 | `client/src/scenes/village.ts`, `dream-effects.ts`, 신규 `village.test.ts`, `dream-effects.test.ts`, `client/src/core/world/nearby.ts`, `move.test.ts`; 측정이 뒷받침할 때만 `move.ts` | 1·2번과 3번 카메라, 4번의 대상/거리/가림 검증. 준비 완료 계약과 world tap 계약 제공. 초기 trace·입자 이동 영상·카메라 높이 결과 제출 |
| P-B 표시 영역·전체 화면·모든 공통 CSS | `client/index.html`, `client/src/main.ts`, `client/src/style.css`, 신규 `client/public/manifest.webmanifest`, 신규 `client/src/viewport.test.ts`, 신규 `scripts/check-mobile-polish.mjs` | 3번 전체 화면 대체 경로·6개 해상도 캡처, 1번 로딩막·5번 조작 스타일. 전체 화면 거절/종료·회전 상태 검증. Node 검증 스크립트는 필요한 최소 범위만 |
| P-C 입력·상호작용 안내·게임 UI 연결 | `client/src/input/controls.ts`, `movement.ts`, `controls.test.ts`, `input.test.ts`, `client/src/ui/game.ts`, `examine.test.ts`, 필요 시 `content/i18n/ko/ui.json`, `en/ui.json` | 4·5번 버튼 제거·플로팅 조작·키보드 대안. 이중 입력/회전/중단 회귀 검사. 기존 선택 저장·token·감상 비측정 유지 |

**병렬 착수 전에 확정할 좁은 연결 계약:**

- P-A는 `Village.whenReady: Promise<void>`를 제공한다. 모델·효과·사전 컴파일·숨은 첫 render 완료 뒤 resolve, 필수 자산 실패 시 reject. 기존 자산 실패 안내는 P-A가 보존한다. P-B는 즉시 로딩막을 그린 뒤 `whenReady` 성공 때만 `new Game(app, village)`를 호출하고, 같은 실행 흐름에서 `updateViewport()`를 다시 호출해 신규 Controls에 현재 세로/가로 상태를 전달한다. 저장된 탐색 상태로 세로에서 시작한 경우에도 첫 입력부터 차단되는지 검사한다. 실패 시 로딩막을 제거해 기존 오류 안내를 보이고 게임을 열지 않는다.
- P-A는 `hitTargetAt(clientX: number, clientY: number): string | null`과 `interactTarget(id: string): void`를 제공한다. 전자는 canvas rect 기준의 시각 hit만 반환하며 범위 밖 안내에도 사용한다. 후자는 ready·거리·가림을 재검증한다. `interactNearby()`와 `onNearbyChange` 기존 호출자는 유지한다. `VillageInput` 타입 반영은 P-C만 한다.
- P-C가 app capture 단계에서 플로팅 pointer를 소유하고 P-A의 hit 결과로 짧은 탭 후보를 구별한다. 소유한 이동 pointer의 up/cancel은 canvas `tap()`에 전달하지 않는다. 왼쪽 영역 밖 tap은 P-A가 처리한다. 양쪽 모두 `interactTarget()`만 실행하고 기존 token 방어를 보존한다.
- P-B는 `.game-controls`, `.move-pad`를 유지하고 원점/손잡이 CSS 변수 이름을 P-C와 먼저 맞춘다. `.talk-button`·버튼에 붙은 `.nearby-hint` 배치는 제거한다. P-C는 DOM과 상태, P-B는 스타일만 수정한다. 로딩막·전체 화면 버튼은 P-B가 main에서 소유해 Game 파일 충돌을 피한다.
- `abraxas:viewport`의 `{portrait,width,height}` 계약을 유지한다. P-C는 이벤트마다 입력을 해제한다. full screen·주소창 변화도 동일 경로로 리사이즈하며 상태 저장을 새로 실행하지 않는다.
- 테스트 fixture는 기존 `Controls`의 최소 DOM mock과 `examine.test.ts`의 village stub을 새 메서드에 맞춰 보완한다. 핵심 거리·충돌 골든 동작은 그대로 둔다. 함수 export를 바꾸면 위에 확인한 모든 호출자와 타입을 같은 패키지/통합 단계에서 갱신한다.

**순서:** Claude 계획 확인 및 마지막 질문 결정 → 위 계약 확정 → P-A/P-B/P-C 독립 파일 작업 → P-A 준비·hit API를 기준으로 P-B/P-C 통합 → 6개 크기 캡처 → 휴대폰 검수 → Claude 검수·PR·정책/공유 기록 갱신. 같은 `village.ts`의 입력 부분을 P-C가 따로 수정하지 않는다.

**아트:** 꽃잎·반딧불 PNG와 CSS 원으로 충분하므로 새 입자/조이스틱 아트 패키지는 열지 않는다. PWA용 규격 아이콘이 없거나 부적합한 경우에만 별도 P-Art(agy Argon4)를 연다. 쓰기는 `assets/_generated/mobile-polish/`의 시안·동명 `.prompt.md`, 사람 선택 후 `client/public/assets/abraxas/ui/ui-app-icon-192.png`, `ui-app-icon-512.png`에 한정한다. 승인된 알 모티프를 사용하며 P-B만 manifest에 경로를 연결한다. 각 PNG 실제 크기·축소 식별성·용량·한글 깨짐을 검증한다.

## 통합 검증표와 정책 인계

| 구분 | 필수 증거 |
| --- | --- |
| 헤드리스 크기 | 844×390, 740×360, 960×540, 1280×720, 915×412, 932×430. 추가 960×432와 세로 390×844. viewport와 실제 canvas rect를 함께 기록 |
| 장면별 캡처 | 같은 위치/포즈/언어/글자 크기의 전후 타이틀·로딩·탐색 대기·이동 중·NPC 대화·사물/안내판·긴 3선택지·글자 확대·결과. 기존 장면에 3선택지가 없으면 검증용 fixture로만 구성하고 측정 데이터를 바꾸지 않음 |
| 입력 영상/검사 | 탭→대화→닫기, 움직임→release, 이동 중 회전→복귀, 왼쪽 아래 대상 탭/드래그 분리, 키보드 E/Space/Enter, 두 손가락·가림·거리 경계. 좌표 입력을 사용 |
| 실기기 | iPhone Safari, Android Chrome, 카카오톡·인스타그램 인앱에서 일반 탭/전체 화면 지원 여부/홈 화면 실행을 구분. 첫 5초·60초 이동·30분 발열, 주소창 변화·노치·복귀 상태 확인. 미확보 기기는 미측정 표기 |
| 실행 명령 | client에서 `npm run typecheck`, `npm test`, `npm run build`, `npm run check:size`; server에서 `go vet ./...`, `go test ./...`, `govulncheck ./...`; 루트에서 `npm run check:scoring`. 각각 결과를 기록 |

Claude가 통합할 정책 수정: `design-policy.md`의 ‘상호작용 버튼 오른쪽 아래’를 ‘범위 안 대상 직접 탭’으로, ‘왼쪽 아래 패드’를 ‘해당 영역에서 조작 중만 나타나는 플로팅 패드’로 교체한다. 16:9는 구성 참고만이며 실제 viewport 전체 렌더라는 문구와 추가 긴 화면 검증을 명시한다. 48px 목표·본문 대비·선택 동등성은 보존한다. 기존 ‘실시간 광원 없음’은 현재 그림자 구현과도 불일치하므로 이번 성능 결론에 맞춰 Claude가 정리하고, 본 계획만으로 광원을 새로 늘리지 않는다.

역할 원본 대체는 [T013 위임 정책 대체본](../tasks/T013-delegation-proposed.md)을 사용한다. `.agents/` 쓰기 제한을 우회하려 권한을 바꾸지 않는다. 공용 `status.md`·`decisions.md`·`lessons.md`·`docs/devlog/2026-11-01.md`와 ADR-0004는 위임 규칙에 따라 Claude가 검수/병합 후 한 번에 갱신한다. 기록에는 ‘AS1 계획 완료, 구현·실기기 미검증’, 확정된 역할 변경, 이 문서의 미결 질문과 실제 검증 결과를 구분해 적는다. Notion 일지 반영도 감독 작업으로 남긴다.

**이번 문서 작업의 검사:** 필수 실행 검사를 시도했으나 `tsc`·`vitest` 미설치, Go build cache 접근 거부, `govulncheck` 미설치로 완료하지 못했다. 환경 설치·제품 코드 수정·커밋은 하지 않았다. 이 결과는 후속 구현의 검사 통과를 대신하지 않는다.

## 사람에게 물을 질문

1. **거리 밖의 대상을 누르면 그쪽으로 자동으로 걸어갈까요?** 추천: 자동 이동 없이 ‘조금 더 가까이 가 보세요’만 표시. 이유: 직접 이동 의도를 유지하고 장애물에 막히거나 원치 않는 대화가 열리는 일을 줄입니다.
2. **데스크톱에서는 E·Space·Enter로 가까운 대상과 상호작용하도록 할까요?** 추천: 기존 Space·Enter를 유지하고 E도 추가. 이유: 화면 버튼을 없애도 키보드만으로 플레이할 수 있고 기존 사용법도 유지됩니다.
3. **iPhone 등 전체 화면이 지원되지 않는 환경에는 ‘홈 화면에 추가’ 안내를 제공할까요?** 추천: 닫을 수 있는 짧은 안내와 홈 화면 실행을 지원하고 일반 탭에서도 계속 플레이 허용. 이유: 주소창 숨김을 강제할 수 없는 기기에서도 선택권과 진행 흐름을 보존합니다.
