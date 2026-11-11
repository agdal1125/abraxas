# T026-A 살아있는 마을 환경

먼저 `docs/tasks/T026-user-brief.md`를 읽는다. 담당 game-engineer, 검수 메인 세션. 브랜치 `art/living-village`, worktree `.claude/worktrees/living-village`.

## 목표

740×360 게임 화면에서 들판이 인트로 영상(`client/public/cinematics/prelude-v3.mp4`)처럼 풀과 돌이 있는 자연으로 읽히고, 가만히 서 있어도 바람과 물과 새가 움직인다.

## 만들 것

1. **풀 들판.** 걸을 수 있는 풀밭에 저폴리 풀잎 포기를 인스턴싱으로 깐다. 흙길, 물, 건물·소품 자리는 비운다. 밑동은 어둡고 끝은 밝은 정점 색을 쓴다. 그림자는 드리우지 않는다.
2. **길가의 돌과 울타리.** 인트로처럼 길 가장자리와 어귀에 회색 바위와 자갈을 더 놓고, 어귀 길에 울타리를 잇는다. 기존 `rock-large`, `rock-small`, `pebbles`, `fence` 에셋과 `content/world/village.json` 배치를 쓴다.
3. **바람.** 나무 수관, 덤불, 풀, 꽃, 갈대가 흔들린다. 돌풍이 들판을 물결처럼 지나간다. 줄기 밑동과 건물은 움직이지 않는다.
4. **물.** 호수 수면에 잔물결과 반짝임이 있고 물가에 파동 고리가 번진다. 수련과 떠 있는 잎이 까딱이며 천천히 떠다닌다.
5. **새와 나비.** 땅에 앉은 작은 새가 주인공이 다가가면 날아오르고, 가끔 새 몇 마리가 하늘을 지나간다. 꽃밭 근처에 나비가 난다.

소리(새소리, 바람, 물)는 이 작업에 넣지 않는다. main에 소리 켜기·끄기 설정이 아직 없다(PR #106 미병합). 후속 작업으로 남긴다.

## 지키는 것

- 새 코드는 `client/src/scenes/nature.ts`(필요하면 `nature-*.ts`)에 둔다. `village.ts`에는 생성·갱신·크기 변경을 잇는 최소한의 줄만 넣는다.
- 조명, 그림자 설정, 인물 코드, `dream-effects.ts`의 기존 입자 수치는 건드리지 않는다. 다른 작업(T026-B, C, D)이 동시에 고친다.
- 새 GLB를 만들지 않는다. 풀잎, 새, 나비, 파동은 코드로 만든 지오메트리를 쓴다. 환경 생성기와 기존 GLB는 다시 내보내지 않는다(PR #83과 충돌).
- 돌과 울타리에는 충돌이 있다. 배치 뒤 `node assets/source/environment/check_landscape_reach.mjs`와 한국어 E2E(`npm run e2e:play`)가 끝까지 통과해야 한다.
- 움직임은 선택과 무관하다. 측정 선택 화면에서 특정 선택지 쪽을 가리키거나 선택 뒤에 반응하는 움직임을 넣지 않는다.
- `prefers-reduced-motion`이면 바람·물·새의 움직임을 멈춘다(기존 `DreamEffects`와 같은 방식).
- 플랫 셰이딩과 재료 색 기준은 `docs/tasks/T018-P3-faceted-direction.md`를 따른다. 텍스처 이미지를 새로 넣지 않는다.
- 성능: 같은 지점에서 `renderer.info.render.calls` 증가를 8 이하로, 삼각형 증가를 화면당 12,000 이하로 잡는다. 새 광원과 후처리를 넣지 않는다. 풀은 드로콜 하나다.

## 합격 기준

- 어귀, 광장, 호숫가, 빵집 앞 740×360과 844×390 전후 캡처에서 풀잎, 돌, 울타리가 보인다.
- 2초 간격 연속 캡처에서 풀·나무·수면·수련 위치가 달라진다.
- 드로콜·삼각형 전후 수치를 같은 지점에서 잰 값으로 보고한다.
- `npm --prefix client run typecheck`, `npm --prefix client test`, `npm --prefix client run build`, `npm --prefix client run check:size`, 한국어 E2E 통과.
- 캡처는 `docs/reviews/T026-A/`에 둔다. 실기기 FPS는 미측정으로 적는다.
