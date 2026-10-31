# 교훈

같은 함정을 다시 밟지 않기 위한 기록. 형식: `- 영역 · 증상 → 원인 → 해결`

- 에이전트 · Antigravity가 `.agents/rules/` 안 규칙을 무시함 → 하위 폴더에 넣었거나 frontmatter `trigger` 값이 잘못됨(camelCase 등) → 규칙 파일은 `.agents/rules/` 바로 아래에 두고 `trigger`는 `always_on | model_decision | glob | manual` 중 하나로 쓴다 (공식 문서 기준, 2026-10-31 확인)
- 성향 설계 · 무작위 선택인데 특정 유형이 19%까지 쏠림 → 보조 적재를 모두 같은 부호로 줌 → 보조 적재 부호도 축별로 균형, `npm run check:scoring`의 '축별 평균 치우침' 확인
- 성향 설계 · 무작위 시뮬레이션은 고르게 나오는데 실제 플레이에서 쏠릴 위험 → '차근차근·순서대로' 같은 같은 단서가 서로 다른 축(L·K·신중)에 반복됨 → 극마다 고유 어휘를 쓴다(L 사실·공정 / K 익숙함·전통 / 신중 위험·손실). 시뮬레이션은 문항 독립을 전제로 하므로 문구 검토로 막는다 (T001 검수)
- 서버 · `go 1.27.0` + `toolchain go1.27.0`에서 `govulncheck`가 표준 라이브러리 `net/http` 취약점 5건(GO-2026-6603 등)으로 실패하고 `go mod tidy`가 동일 버전 `toolchain` 줄을 제거함 → Go 1.27.0 표준 라이브러리 취약점이 1.27.2 이상에서 수정됨 → `go.mod`에 `go 1.27.0`과 `toolchain go1.27.3`을 함께 명시해 패치 툴체인을 고정하고 `govulncheck` 통과
- 에이전트 · `agy -p`(headless)로 작업을 맡기면 명령·파일 쓰기가 전부 자동 거부되어 아무것도 안 하고 끝남 → 이 계정은 `--mode auto` 불가, 허용 규칙 `command(...)`은 **명령 문자열 정확 일치**만 통과(`command(go)`·`command(go *)` 불가), 셸 연산자(`&&`,`|`)는 별도 안전 검사로 차단 → `--settings <json>`에 실행할 명령을 정확한 문자열로 나열하고, 파일 쓰기는 `write_file(C:/절대/경로/디렉터리)`(슬래시, 디렉터리 접두 일치)로 허용. 프롬프트에 허용 명령 목록과 `go -C server ...` 형식을 명시하고, 커밋은 검수자가 한다 (2026-10-31 확인)
- 에이전트 · Codex가 Windows에서 쓴 한국어가 파일에 `?`로 저장됨 → PowerShell 기본 인코딩(ANSI)으로 파일을 씀 → Codex 지시문에 "파일은 UTF-8로, PowerShell `Set-Content`/`Out-File` 대신 패치 도구로 쓴다"를 넣고, 검수 때 `grep -rl "???"`로 확인한다 (2026-10-31)
- 대사 · ink 측정 선택지 태그가 런타임에서 빈 배열 → `* [문구] # tag`처럼 대괄호 뒤에 둔 태그는 inkjs가 선택지 태그로 읽지 않음 → `* [문구 # item:x # pick:a]`처럼 대괄호 안에 둔다. `compile-ink.mjs`가 잘못된 위치를 오류로 막는다 (2026-10-31)
- 클라이언트 · SVG 배경·초상이 검게 그려지고 콘솔에 `texImage2D: bad image data` → SVG에 width/height 속성이 없음(viewBox만) → `this.load.svg(key, url, { width, height })`로 크기 지정 (2026-10-31)
- 클라이언트 · 대사 중 빈 곳을 누르면 타이틀로 돌아감 → `children.removeAll(true)` 뒤에도 이전 화면 버튼의 `once(pointerdown)`이 실행됨 → 화면을 그릴 때마다 token을 올리고 핸들러는 같은 token일 때만 실행 (2026-10-31)
- 에이전트 · im-not-ai `--copy` 설치 시 `$humanize-korean` 스크립트가 `~/scripts/...`를 찾다 실패 → 스킬 안 스크립트가 저장소 루트 스크립트를 상대 경로로 부르는 shim → `~/tools/im-not-ai` 클론을 `~/.codex/skills/humanize-korean`에 Windows junction으로 연결 (2026-10-31)
- 검증 · 로컬 화면 자동 확인은 헤드리스 Edge + CDP(Node 내장 WebSocket)로 가능. 프로필은 절대 경로 `--user-data-dir`, 클릭 전 `mouseMoved`, 클릭 간격 300ms 이상 (2026-10-31)
- 클라이언트 · KayKit 헥스 타일이 겹쳐 보임 → 타일은 x폭 2·z 2.3의 pointy-top이라 헥스 크기 2/√3 → world 변환에 HEX=2/√3 고정 (2026-10-31)
- 클라이언트 · KayKit 팩마다 모델 축척이 다름(medieval 집 0.93, restaurant 상자 2.0, furniture 램프 2.5) → 팩별 기본 축척(medieval 1, city 0.6, furniture 0.25, restaurant 0.12), 캐릭터 0.4배 (2026-10-31)
- 검증 · 3D 화면은 좌표 탭 자동화가 어려움 → 개발 모드 전용 `window.__abraxas` 훅으로 상호작용을 호출하고 DOM 오버레이 버튼은 JS로 클릭. 탭 이동은 CDP `Input.dispatchTouchEvent`로 따로 확인 (2026-10-31)
- 에셋 · Kenney 사이트 zip 링크 자동 추출은 봇 차단 우회로 막힘 → 공식 GitHub(KayKit-Game-Assets 등) 배포본을 sparse checkout (2026-10-31)
- 에이전트 · `codex exec -i a.png -i b.png "프롬프트"`에서 프롬프트가 이미지 인자로 먹혀 "No prompt provided"로 종료 → `-i`가 여러 값을 받는 옵션 → 프롬프트를 파일로 두고 표준 입력(`< prompt.md`)으로 넘긴다 (2026-11-01)
- 클라이언트 · 줌인하면 KayKit 헥스 타일 테두리가 격자로 도드라짐 → 풀·길 타일은 걷기 데이터로만 쓰고 연속 땅 평면 + 코드 생성 텍스처로 렌더, 땅 바탕색은 KayKit 풀 색을 텍스처에서 읽어 맞춤 (2026-11-01)
