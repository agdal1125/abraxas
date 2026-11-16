---
name: threejs-mobile-perf
description: Abraxas Three.js 렌더 성능을 재고 개선한다. 드로콜, 인스턴싱, 로딩, 메모리, 실제 폰 프레임, 성능 게이트 판단이 필요할 때 쓴다.
---

# Three.js 모바일 성능

숫자를 믿기 전에 무엇을 쟀는지 설명한다. 렌더 변경 전에 기준값부터 남긴다.

## 측정 항목을 나눈다

| 항목 | 방법 | 기기 의존 |
| --- | --- | --- |
| 드로콜, 삼각형, 텍스처, 지오메트리 수 | 개발 모드 `window.__abraxas.village`로 렌더 직후 `renderer.info` | 아니오 |
| 첫 화면, 전송량, JS 힙 | `node client/scripts/perf-mobile.mjs <port>`. Edge, SwiftShader, CPU 감속 환경 | 예, 상대 비교만 |
| 프레임, 발열 | 실제 폰 | 예 |
| 번들 용량 | `npm --prefix client run build`, `npm --prefix client run check:size` | 아니오 |

SwiftShader나 가려진 탭의 FPS를 성능 근거로 쓰지 않는다. FPS를 잴 때는 내장 브라우저 탭을 앞에 둔다. 드로콜 같은 기기 무관 수치는 패널이 숨겨져도 수동 렌더로 잴 수 있다.

```js
const v = window.__abraxas.village, r = v.renderer;
r.info.autoReset = false; r.info.reset();
r.render(v.scene, v.camera);           // full
// then r.info.reset(); r.shadowMap.autoUpdate = false; render again: difference is the shadow pass
// restore autoReset and autoUpdate afterwards
```

이 방식은 후처리(`effects`)를 포함하지 않는다. 그렇게 적는다.

## 대표 장면

어귀, 광장, 빵집 앞, 축제, 기억의 문의 다섯 장면에서 잰다. 커밋, 뷰포트, DPR, 캐시 조건을 함께 적는다. 개발 훅으로 위치를 옮겨 재는 방법은 M1에서 만든다. 그전에는 잰 장면을 적는다. 기준값은 `docs/reviews/m0-trial/perf-baseline.md`에 있다.

## 실제 폰 측정

사람이 기기를 쥐어야 한다. 대상은 중급 Android Chrome, iPhone Safari, 카카오톡 인앱이다. 5분 예열 뒤 같은 동선 60초를 3회 잰다. 임시 목표는 평균 30 FPS, 프레임 간격 p95 50ms다. 여유 기기는 60 FPS를 지향한다. 기종, OS, 브라우저, 전원 상태를 적는다. 측정이 없으면 '미측정'이다. 끝까지 한 회차에서 발열과 메모리 증가도 본다.

## 줄이는 순서

1. 측정으로 가장 큰 항목을 찾는다.
2. 움직이지 않는 그림자는 대상을 줄이거나 갱신을 멈춘다. 기준 장면에서 그림자 pass가 calls의 37%다. 캐릭터 그림자는 움직이므로 분리한다.
3. calls가 병목이면 반복 배치를 `InstancedMesh`로 바꾼다. 메시 수로 효과를 계산하지 않는다. 메시 513개여도 컬링 뒤 calls는 75였다. 공간 단위로 나누지 않으면 컬링이 약해진다. 충돌, 숨김 상태, 상호작용 대상은 개별로 남긴다.
4. 기기 등급별로 DPR, 그림자, 효과를 낮춘다. 모바일 DPR 상한은 1.5다.
5. 에셋은 `gltf-transform inspect`로 진단한다. 지금 GLB는 Draco를 쓴다. 바꾸려면 디코더 크기까지 포함해 전후를 비교한다.

읽기 어려운 UI, 측정 오염, 충돌 무시로 프레임을 얻지 않는다.

## 보고 형식

```text
커밋 / 뷰포트 / DPR / 장면
calls, triangles, geometries, textures: 전 → 후 (기준선이면 값만)
기기 FPS, p95: 전 → 후 또는 미측정
후처리 포함 여부
원인 설명: 왜 이 숫자가 바뀌었는가
```

수치가 변한 이유를 설명하지 못하면 개선으로 보고하지 않는다.

외부 스킬 `three-best-practices`, `threejs-skills`가 설치돼 있으면 참고한다. 프로젝트 three 버전과 맞는지 타입 정의로 확인한다.
