# M0 시험: 렌더 수치 기준선 (game-engineer)

2026-11-08 · 기준 #90 · 일반 subagent가 역할 파일과 `threejs-mobile-perf`를 읽고 수행. 메인이 calls, 삼각형, 메시 수를 같은 방법으로 다시 쟀다. 코드와 파일은 고치지 않았다.

**판단.** 이 장면의 calls는 119로 낮다. 메시가 500개 넘어도 프러스텀 컬링이 대부분을 거른다. 그래서 인스턴싱은 기본 해법이 아니라 측정 뒤 고를 후보다. 계획서의 '`place()`를 인스턴싱'은 이 측정으로 우선순위를 낮춘다. 실제 폰의 FPS와 발열을 먼저 잰다.

## 조건

- 뷰포트 740×360 에뮬레이션, DPR 2.0, 모바일 상한으로 렌더 픽셀 비율 1.5, 캔버스 1110×540
- 장면: 프롤로그의 마을 어귀 근처 한 곳. 5개 대표 장면은 재지 않았다
- 방법: `renderer.info.autoReset`을 끄고 `renderer.render`를 직접 호출. 후처리(`effects`)는 포함하지 않았다
- FPS, 프레임 간격: 미측정(패널 숨김)

## 수치

| 항목 | 값 |
| --- | --- |
| 그림자 포함 calls, 삼각형 | 119, 42,848 |
| 그림자 맵 갱신 끔 calls, 삼각형 | 75, 28,992 |
| 그림자 pass 몫 | calls 44(37%), 삼각형 13,856(32%) |
| geometries, textures, programs | 52, 13, 11 |
| 오브젝트, 메시, SkinnedMesh, InstancedMesh | 1127, 513, 10, 0 |
| castShadow 메시 | 180 |
| 고유 geometry, material | 80, 64 |
| GLB 합계 | 81개, 753,108 bytes(최대 `terrain.glb` 87,864 bytes) |

## 반복 상위 (조합 × 개수, 개당 삼각형)

grass-small ×77(48), flower-cluster-yellow ×56(280), flower-cluster-white ×45(280), pebbles ×38(80), flower-cluster-pink ×38(280), rock-large ×22(40), grass-tuft ×19(60), flower-cluster-purple ×16(280), mushroom ×16(144), bush ×13(260). 이 중 그림자를 던지는 것은 rock-large와 bush뿐이다.

## 원인 설명

- `place()`는 `gltf.scene.clone()`을 써서 geometry와 material을 공유한다. geometries 52는 공유 덕이고, main calls 75는 컬링 덕이다.
- 그림자 pass 44 calls는 castShadow 메시 중 광원 프러스텀 안에 든 것을 다시 그린 값이다. 정적 소품의 그림자를 분리해 갱신을 줄이면 이 몫을 줄일 수 있다. 캐릭터 그림자는 움직이므로 함께 끌 수 없다.

## 후보와 추정

- 인스턴싱: 합계 119 → 55~75(추정, 미검증). 개체별 컬링이 사라지므로 공간 단위로 나누지 않으면 삼각형이 늘 수 있다.
- 정적 그림자 분리: 그림자 몫 44 calls 감소 가능(추정).
- 어느 쪽이든 실제 폰 측정으로 병목을 확인한 뒤 고른다.
