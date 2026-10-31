# 품질 개선 1차 계약서 (Quality Pass 1)

근거: `docs/reviews/2026-11-01-quality-review.md` §4 P0~P1, §7 결정(Three.js·정사영·단일 맵·고정 낮 조명·중립 반응). Blender가 없어 베이크 대신 코드 생성으로 같은 목표를 낸다.

**레퍼런스 원칙**: 사람이 준 목표 스냅샷은 화질·밀도·접지감·캐릭터 표현력 *수준*의 기준이다. 그 게임의 캐릭터·꽃·가구·UI·배치를 복제하거나 따라 그리지 않는다. 모든 형태·배치는 Abraxas의 장소·역할에서 새로 만든다.

## 작업 분담 (파일 독점)

| PR | 담당 | 독점 파일 |
| --- | --- | --- |
| Q1 환경 배치 | agy argon | `content/world/village.json`, `docs/art/quality-environment.md` |
| Q2 월드 렌더 | Codex terra high | `client/src/scenes/village.ts`, 신규 `client/src/scenes/decor.ts`, `client/src/main.ts` |
| Q3 캐릭터 | Codex terra high | 신규 `client/src/scenes/characters.ts` 와 그 테스트 없음(시각 요소) |
| Q4 UI | Codex terra medium | `client/src/ui/**`, `client/src/style.css` |

## 계약 1: 장식(decor) — Q1이 쓰고 Q2가 그린다

`village.json`에 최상위 `decor` 배열을 추가한다. **장식은 통행을 막지 않는다**(기존 `props`는 계속 차단).

```jsonc
"decor": [
  { "q": 1, "r": 2, "kind": "flowers_red", "dx": 0.2, "dz": -0.1, "rot": 0.5, "scale": 1 }
]
```

- `dx`·`dz`: 헥스 중심에서의 오프셋(월드 단위, -0.6~0.6). 한 칸에 여러 개 가능.
- `kind` 목록(Q2가 코드로 만드는 원본 저폴리 형태): `flowers_red`, `flowers_yellow`, `flowers_white`, `flowers_pink`, `flowers_purple`(꽃 3~5송이 다발), `grass_tuft`(잔풀 무더기), `pebbles`(작은 돌 3~4개), `mushroom`(작은 버섯 2개), `log`(쓰러진 통나무 토막), 또는 `model:<pack>/<name>`(기존 KayKit 모델을 장식으로, 예: `model:city/bush`).

## 계약 2: 캐릭터 — Q3이 만들고 Q2가 쓴다

`client/src/scenes/characters.ts`:

```ts
import * as THREE from "three";
export type CharacterState = "idle" | "walk" | "talk";
/** id: "A" | "B" | "C" | "D" | "player" | 퀘스트 NPC 코드(s1j2 등). 원점 = 발바닥 중앙, 정면 = +Z, 최종 키 0.55~0.65 월드 단위(집 높이 약 0.93). */
export function createCharacter(id: string): THREE.Group;
/** 매 프레임 호출. t = 경과 초, dt = 프레임 초. 걷기 흔들림·팔다리 스윙·눈 깜빡임·대기 호흡. */
export function animateCharacter(group: THREE.Group, state: CharacterState, t: number, dt: number): void;
```

- 3등신에 가깝게, 점 눈 + 작은 입, 손발이 보이는 SD. 실루엣: A 공형·작은 깃발, B 물방울형·앞치마, C 원기둥형·큰 머리·둥근 안경, D 블록형·넓은 어깨·작은 망치. 대표색은 디자인 시스템 그대로. 주인공은 얼굴 없는 둥근 형태 + 알 껍질 조각(머리에 쓴 반쪽 껍질). 퀘스트 NPC는 회색조 둥근 형태 + 작은 모자.
- 머티리얼은 공유(색별 1개), 메시 수 캐릭터당 20개 이하.
- 표정·반응으로 좋고 나쁨을 암시하지 않는다(측정 정책).

## Q2 월드 렌더 목표 (리뷰 §4 P0·P1)

- 카메라: 주인공 키가 화면 높이의 10~14%. 바다 바깥 단면·배경 경계가 보이지 않게(넓은 바다 평면 + 배경색 일치, 또는 카메라 경계 제한).
- 접지: 캐릭터·나무·집·소품 아래 부드러운 가장자리의 원형 그림자(방사형 그라디언트 텍스처 1장 공유).
- 지면: 잔디 타일에 약한 색 변화(타일마다 밝기 ±4% 정도), 헥스 홈이 주된 패턴으로 보이지 않게 가장자리 대비를 낮춤.
- 장식 렌더: `decor`를 kind별 InstancedMesh로 그림.
- 이동: 델타 시간 기반 속도, 탭 지점 표시(작은 원 물결), 상호작용 대상 앞에서 마주보기, 걷는 동안 `animateCharacter(..., "walk")`.
- NPC 대기 동작은 화면 안 가까운 캐릭터만. 정지 시 렌더 생략은 유지하되 대기 동작이 보이는 동안은 렌더.
- 조명: 고정 낮. 반구광 + 방향광, 톤 매핑은 비교 후 하나 선택.

## Q4 UI 목표 (리뷰 §4 P0 UI)

- 안전 영역(`env(safe-area-inset-*)`), 터치 영역 48×48 CSS px 이상, 본문 15px 이상.
- 대비 4.5:1: 흰 글자를 올리는 강조색 버튼은 글자를 `ink`로 바꾸거나 강조색을 더 진하게.
- 읽기 순서: 상황(대사창) → 선택지. 선택지는 모두 같은 폭·높이·색.
- 측정 직후 반응은 중립 2종 그대로, 하트·물음표 없음.

## 공통

- 새 의존성 없음. 파일 UTF-8. 커밋은 Claude가 한다. `docs/memory`·`docs/devlog`는 Claude가 병합 후 갱신.
- 완료 확인: 390×844 캡처(어귀·광장·NPC 근접 대화·해안) + 자동 플레이 완주.
