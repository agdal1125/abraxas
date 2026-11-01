# 원본 아트·자유 이동 개편 계획

2026-11-01 · 계획·작업 프롬프트만 작성. **구현 착수 전 검토용**이며 아래 예산은 제작 목표다. 이번 변경은 이 문서 하나로 한정하고 코드·콘텐츠·에셋·기존 계약서는 수정하지 않는다. 커밋·작업자 실행도 하지 않는다.

우선순위는 측정 정책 → 이번 사람 피드백 → 이 계획 → 기존 계약이다. 이번 피드백으로 기존 문서의 Blender 미설치, KayKit 재사용, 코드 조립 캐릭터, 헥스 이동 지침을 대체한다. Three.js·정사영·단일 맵·고정 낮은 유지한다. 계획·기술 리뷰는 **Codex Astra**, 구현은 **Codex Terra(`gpt-6.1-terra`)**, 아트는 **agy(`gemini-4-argon-medium`)**가 맡는다. Claude는 지시·검수 진행·프롬프트 교정 등 오케스트레이션만 맡고 직접 구현·아트 제작을 하지 않는다.

## 1. 목표와 완료 기준

현재 `client/src/` 전체와 지정 문서를 정적 검토했다. `village.ts`는 연속 지면을 그리지만 `walking`·`moveTo()`는 헥스 BFS이고, 모든 `props`가 칸 전체를 막는다. `characters.ts`·`decor.ts`는 코드 도형이며 `placeModel()`은 KayKit 경로·팩별 축척에 의존한다. 맵은 타일 271개, 소품 111개, 장식 586개이며 추가 식생도 코드로 생성한다. 수량 증가보다 원본 형태·축척·접지·조작 개선이 먼저다.

| 확인 | 완료 기준과 증거 |
| --- | --- |
| 원본 디자인 | 캐릭터 6종과 환경 키트 전부 생성 컨셉 PNG → Blender 소스 → GLB → 게임 화면으로 추적된다. 기존 게임·애니 캐릭터·소품·건물의 모방 지시 및 KayKit 런타임 요청 0건. 레퍼런스는 **둥글고 따뜻한 로우폴리 디오라마**라는 품질·톤만 사용한다. |
| 첫 품질 구간 | player·A·어귀·광장부터 완성해 Astra가 검토한다. 390×844·360×640 CSS px에서 주인공 높이 화면의 10~14%, 큰 랜드마크 1개·중간 소품 군집 2개·작은 식생 군집 3개가 보이고 동선·얼굴을 가리지 않는다. 통과한 형태·재질로 다른 구역을 확장한다. |
| 형태·화면 | 4인 흑백 실루엣, 6종 정면·측면·쿼터뷰, idle/walk/talk 연속 프레임 제출. 어귀·광장·대화·해안 캡처에서 타일 홈·떠 있는 발·검은 AO 얼룩·바다 외곽 단면이 없어야 한다. |
| 자유 이동 | 키보드와 실제 터치로 직선·대각선·벽 따라 미끄러짐·좁은 통로·다리 왕복 영상 제출. 어귀→4인→퀘스트 NPC 4명→호수→광장→기억의 문 접근 가능. 격자 스냅·건물/물 관통·대화 중 이동 0건. |
| 입력·측정 | 모바일 패드와 말하기 버튼이 안전 영역을 지키며 48px 이상 터치 영역 확보. 입력 취소·앱 전환 뒤 자동 이동 없음. 선택지/저장 순서·중립 반응 유지, 성향/호감도 수치·내부 축 설명·금지 명칭 노출 없음. |
| 성능 | 초기 요청 합계 10MiB 이하, 저사양 Android의 카카오톡·Instagram 인앱에서 30fps 목표. iOS Safari/인앱도 조작 검수. 기기·OS·앱 버전·DPR·회선·캐시 조건과 60초 이동의 프레임 시간(p95 33.3ms 이하 목표), 30분 발열/메모리 추이 기록. 데스크톱 캡처를 실기기 증거로 대신하지 않는다. |

측정 문항·가중치·초대권·결과 저장의 판정은 변경하지 않는다. 현 프로토타입의 저장 실패 처리·서버 연결·고백/결과 3장 미완성은 별도 작업이며 이 개편으로 해결됐다고 보고하지 않는다.

## 2. 아트 바이블

### 형태·색·축척

- 성별 중립 SD **3등신**, 점 눈·작은 입. player는 눈·입 없는 둥근 몸과 머리에 쓴 반쪽 알 껍질. 퀘스트 NPC는 회색조·작은 모자. 귀여움은 실루엣과 자세로 만들고 기존 IP의 얼굴·의상·소품 도안을 가져오지 않는다.
- 외곽은 두툼하게, 가장자리 베벨 1~2 segment·폭 0.01~0.03m. 얼굴·몸은 부드러운 노멀, 지붕·목재·바위는 의도한 면만 분리한다. 무차별 subdivision·날카로운 기본 큐브·노멀맵으로 디테일을 보충하지 않는다. 최종 삼각화 후 예산을 센다.
- 재질은 불투명 `MeshStandardMaterial` 대응 PBR, metallic 0, roughness 0.75~0.95. 캐릭터당 재질/primitive 2개 이하, 작은 소품 1개, 건물 2개 이하. 잎·꽃은 얇은 불투명 입체, 알파 카드 군집은 피한다.
- 대표색: A `#FF7A59`, B `#FFB020`, C `#8E6BFF`, D `#14B8A6`. cream `#FFF8EC`, ink `#3B2A22`, grass `#5CC96B`/`#3A9E57`, path `#F2B35E`, sea `#5BC0F8`, wood `#9B7355`, stone `#B1ADA2`. 회색조 NPC `#A0A0A0`/`#777777`. 환경의 고채도 면적을 줄이고 대표색은 캐릭터의 큰 면에 쓴다. UI 대비 보정색과 모델 대표색을 혼동하지 않는다.
- **1 unit = 1m**. 캐릭터 키 0.60m(player 0.58m, C 0.65m까지), 머리 약 0.20m, 문 개구부 높이 0.85m·폭 0.65m, 건물 1.4~1.8m, 나무 1.2~1.8m. 기존 이동 속도 2.2m/s는 새 비례에 빠르므로 1.4m/s에서 조작 검수한다. 이는 측정 수치와 무관하다.
- 원점은 발바닥/바닥 접지면 중앙. Blender는 Z-up·정면 -Y, 내보낸 GLB/게임은 Y-up·정면 +Z, 바닥 XZ. 리그 전 회전·축척 적용, export root의 scale 1·회전 0, 음수/비균일 scale 금지. 원점·정면·1m 기준자를 미리보기에서 확인한다.

### 버텍스 컬러·AO·내보내기

기본은 **버텍스 컬러 `COLOR_0`**로 색과 약한 자체 AO를 표현한다. 색별로 재질을 늘리지 않고, 색 경계에서 필요한 정점만 분리한다. Cycles에서 정지 자세의 자체 AO를 임시 UV 이미지 512²에 베이크(32 samples부터, 여백 8px)한 뒤 선형 공간에서 색과 약하게 곱해 정점에 옮긴다. 겨드랑이·관절은 과도하게 굽지 않는다. 임시 UV 이미지·렌더는 source에만 보관한다. 모델 자체 AO는 지면으로 떨어지는 그림자를 대신하지 않는다.

지면처럼 정점만으로 부족한 면만 1024² 이하 컬러 아틀라스 1장과 AO 1장을 허용한다. base color는 sRGB, AO는 non-color이며 이중 AO를 피한다. 일반 소품마다 큰 PNG를 GLB에 중복 삽입하지 않는다. 베이크·내보내기의 API 이름은 설치된 Blender에서 확인하고, 존재하지 않는 옵션을 추측하지 않는다. Blender의 glTF는 버텍스 컬러·AO·애니메이션·Draco를 지원하지만 연결 방식과 옵션은 버전 확인이 필요하다. [Blender glTF 공식 문서](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html)

| 내보내기 항목 | 제작 계약 |
| --- | --- |
| 형식 | glTF 2.0 binary `.glb`, 선택한 에셋 collection만, +Y up. 메시·노멀·COLOR_0·필요 UV·skin·animation 포함. 카메라·광원·컨셉 plane·검수 기준자 제외. 텍스처가 있으면 GLB 내부 포함. |
| 압축 | Draco 사용, level 6 시작값, position 14bit·normal 10bit·color/UV 12bit. 눈·안경·베벨·발 위치의 압축 전후 차이를 검사하고 필요한 항목만 정밀도를 높인다. Draco는 메시 압축이며 이미지/애니메이션 용량은 별도 줄인다. |
| 런타임 | Terra가 설치된 Three.js의 `DRACOLoader`와 동봉 디코더를 동일 출처 `/assets/abraxas/decoders/`로 제공한다. 디코더 1개 인스턴스·worker 1개부터. CDN·새 패키지 추가 없음. 누락 시 로딩 실패를 표시하고 시작을 막는다. [공식 Draco 로더](https://threejs.org/docs/pages/DRACOLoader.html) |
| 리그·클립 | 최대 16 deform bones, 정점당 weight 최대 4, 캐릭터당 skinned mesh 최대 2. **Blender Action 베이크 권고**: `idle` 2초, `walk` 0.8초, `talk` 1.6초, 24fps, 제자리 loop·root translation 0. 소품은 손 본에 결합. 제약/IK는 본 TRS로 굽고 실제 GLB에 3클립이 있는지 확인. |
| 게임 동작 | `AnimationMixer`로 0.12초 전환. 이동은 게임 root만 담당, walk 배속은 실제 이동 거리 기준. talk는 한 가지 중립 동작을 공감/생각 반응에 동일 적용. 기존 코드 본 애니메이션은 제거하고 방향 전환만 코드로 처리. |
| 파일 예산 | §3의 GLB 상한은 내장 이미지·클립을 포함한 디스크 바이트. PNG 컨셉은 1536² 이하·미리보기 1024² 이하, 웹 배포 제외. `.blend`·Python·임시 베이크도 source에만 둔다. |

## 3. 에셋 목록과 예산

`tri`는 최종 export 삼각형 상한, `KiB`는 GLB 하나의 상한이다. 충돌은 원형 `r`, 로컬 박스 반폭 `hx,hz`로 표기하며 모두 m 단위다. 높이는 충돌 계산에 쓰지 않는다. 아래 키·치수는 최초 매니페스트 계약이며 변경 시 Astra가 맵·아트·코드 영향부터 확인한다.

| 키 / 종수 | 원본 형태·크기 | tri / KiB | 기본 충돌 |
| --- | --- | --- | --- |
| `char-a` | 공형·깃발, 키 0.60 | 3,000 / 180 | circle r=0.18 |
| `char-b` | 물방울형·앞치마, 키 0.60 | 3,000 / 180 | circle r=0.18 |
| `char-c` | 원기둥형·큰 머리·둥근 안경, 키 0.65 | 3,500 / 180 | circle r=0.18 |
| `char-d` | 블록형·넓은 어깨·망치, 키 0.60 | 3,000 / 180 | circle r=0.20 |
| `player` | 얼굴 없는 몸·반쪽 알 껍질, 키 0.58 | 2,000 / 120 | circle r=0.18 |
| `quest-npc` | 회색조·작은 모자, 키 0.56; 4개 NPC ID가 공유 | 2,000 / 120 | circle r=0.18 |

건물은 **구역에 배정하는 고유 모델 총 6종**으로 시작한다. 구역마다 6종씩 늘리지 않는다. 형태 차이는 지붕 윤곽·출입구·역할 소품으로 만들고 같은 게임의 건물처럼 만들라는 지시는 금지한다.

| 키 / 종수 | 구역·치수(폭×깊이×높이) | tri / KiB, 개당 | 기본 충돌 |
| --- | --- | --- | --- |
| `entrance-house` | 어귀, 1.4×1.2×1.4 | 4,000 / 180 | box hx=.65 hz=.55 |
| `plaza-hall` | 광장, 1.8×1.5×1.6 | 5,000 / 180 | box .85,.70 |
| `bakery` | 빵집, 1.6×1.4×1.5 | 5,000 / 180 | box .75,.65 |
| `library` | 도서관, 1.8×1.5×1.8 | 5,000 / 180 | box .85,.70 |
| `smithy` | 대장간, 1.8×1.4×1.5 | 5,000 / 180 | box .85,.65 |
| `lake-pavilion` | 호수 쉼터, 1.6×1.4×1.4; 이번에는 내부 진입 없음 | 4,000 / 180 | box .75,.65 |
| `tree-round`, `tree-layered`, `tree-slender`, `tree-young` | 나무 4종, 높이 1.5/1.8/1.6/1.2 | 1,200 / 60 | 줄기 circle r=.16/.20/.16/.12; 수관 제외 |
| `bush` | 덤불, .6×.5×.4 | 500 / 30 | circle r=.22 |
| `flower-bed` | 꽃 화단, .7×.5×.25; 한 모델에 꽃 5색을 버텍스 컬러로 혼합 | 600 / 35 | 낮은 꽃은 none |
| `grass-tuft`, `mushroom`, `pebbles` | 작은 식생·버섯·자갈, 폭 .15~.30 | 160 / 15 | none |
| `fence` | 울타리 1.0×.12×.45 | 400 / 25 | box .50,.06 |
| `rock-small`, `rock-large` | 돌 2종, 폭 .4/.8 | 300/600 / 20/35 | circle r=.18/.36 |
| `streetlight` | 가로등, 높이 1.0 | 650 / 40 | circle r=.10 |
| `bench` | 벤치, .8×.35×.45 | 800 / 45 | box .40,.18 |
| `well` | 우물, .8×.8×.8 | 1,500 / 70 | circle r=.38 |
| `festival-stage` | 무대, 1.8×1.2×1.0 | 2,500 / 100 | box .90,.60; 앞쪽 광장에서 상호작용 |
| `memory-gate` | 기억의 문, 1.4×.5×1.6 | 2,500 / 100 | 기둥 box 2개, 각 .15,.25, 중심 x=±.55; 가운데 통과 |
| `bridge` | 다리, 1.0×2.0×.35, 상판은 y=0 기준 | 1,800 / 80 | 난간 box 2개, 각 .05,1.0, 중심 x=±.48; 중앙은 통행 |
| `water-reed`, `water-flower`, `shore-post` | 물가 3종, 높이 .35/.12/.50 | 500 / 30 | 수초·꽃 none, 말뚝 circle r=.08 |
| `bread-crate`, `book-stack`, `tool-rack`, `barrel`, `log` | 생활 소품 5종, 폭 .3~.6 | 700 / 40 | 상자/책 box .18,.14; 공구대 .28,.16; 통 circle .15; 통나무 box .30,.10 |
| `terrain` | 연속 섬·길·해안, 맵 v2 외곽/호수와 일치 | 8,000 / 900 | 개별 shape 없음; 맵 통행 polygon 사용 |

작은 장식은 통행을 막지 않는다. 큰 바위·덤불·울타리에는 충돌을 둔다. 기존 586개 장식을 그대로 늘리거나 자동 식생을 이중 추가하지 말고, 군집 수와 시야 내 삼각형 예산으로 배치한다. 기존 산·구름·팩 소품은 새 키트로 재구성하거나 제거하고, 숨은 KayKit fallback을 남기지 않는다.

## 4. 제작 파이프라인과 매니페스트

1. agy가 **image-generator**로 캐릭터별 정면·측면 턴어라운드와 팔레트 칩, 환경 모델별 정면·측면·쿼터뷰 컨셉을 PNG로 만든다. `assets/source/concepts/characters/`, `assets/source/concepts/environment/`에 저장한다. 생성 도구·모델·프롬프트·채택 이유를 각 source의 `provenance.md`에 적는다. 기존 에셋을 원본 컨셉으로 등록하지 않는다. image-generator가 없거나 실패하면 그 단계의 미완료를 보고한다.
2. 컨셉 확인 후 agy가 `assets/source/characters/build_characters.py`, `assets/source/environment/build_environment.py`를 작성한다. 각 폴더에 `.blend`·베이크·`asset-metadata.json`도 둔다. Python은 Blender 내부 제작에 필요한 예외이고 저장소 변환/검증 스크립트는 Node `.mjs`로 쓴다.
3. 부록에 명시한 **정확한 한 줄 명령만** 실행한다. 스크립트 안에서 Blender 실제 버전·tri·재질·클립·bounds·바이트를 기록한다. 설치 경로의 존재는 이번에 확인했지만 실행 버전은 아직 확인하지 않았다. 사람 제공 버전은 5.2.3 LTS다.
4. GLB는 `client/public/assets/abraxas/characters/` 또는 `environment/`, 미리보기 PNG는 `assets/source/previews/characters/` 또는 `environment/`에 쓴다. 미리보기에는 정면·측면·게임 각도·흑백 실루엣·발 원점이 포함된다. Blender 렌더와 실제 Three.js 화면을 함께 비교한다.
5. Terra 맵 담당만 `content/assets/manifest.json`을 작성한다. agy는 자기 source metadata로 키·치수·충돌·클립·용량을 인계하고 공유 manifest를 쓰지 않는다. 렌더 담당이 실제 GLB와 manifest의 일치를 검증한다.

매니페스트 예시(형식 설명용이며 이 문서에서 실제 JSON 파일은 만들지 않는다):

```json
{
  "version": 1,
  "assets": {
    "char-a": {
      "path": "assets/abraxas/characters/char-a.glb",
      "scale": 1,
      "collision": [{ "type": "circle", "x": 0, "z": 0, "radius": 0.18 }],
      "clips": ["idle", "walk", "talk"]
    },
    "bakery": {
      "path": "assets/abraxas/environment/bakery.glb",
      "scale": 1,
      "collision": [{ "type": "box", "x": 0, "z": 0, "halfX": 0.75, "halfZ": 0.65 }]
    },
    "flower-bed": {
      "path": "assets/abraxas/environment/flower-bed.glb",
      "scale": 1,
      "collision": []
    }
  }
}
```

경로는 public 기준 상대 경로이며 Vite base로 해석한다. 외부 URL·상위 경로 이동·없는 키를 거부한다. collision 배열은 문기둥/다리의 복합 형상용이며 빈 배열은 비충돌이다. 좌표는 유한값, 반경·반폭·scale은 양수여야 한다. 최종 scale은 manifest.scale × 배치.scale, 로컬 중심과 형상 모두 같은 scale·배치 rot로 변환한다. rot는 Y축 오른손계 radian이다. 건물을 돌렸을 때 충돌만 축에 평행하게 남기지 않는다.

## 5. 자유 이동·맵 v2

### 이동과 충돌

- XZ 연속 좌표의 평면 이동이다. 기존 Hex·walking·BFS·타일 중심 스냅을 제거한다. player는 반경 .18m 원, 장애물은 manifest의 원/회전 박스, NPC도 각 원을 사용한다.
- 입력은 화면의 오른쪽/위쪽에서 카메라의 XZ 기저로 변환하고 길이를 최대 1로 제한한다. 대각선 속도를 늘리지 않는다. 속도 1.4m/s, delta time 기반이며 복귀 시 dt는 .05초 이하로 제한한다.
- 최대 .04m substep으로 이동 후보를 만든다. 최초 접촉점까지 진행한 뒤 남은 변위의 벽 안쪽 법선 성분을 제거해 접선으로 미끄러진다. 최대 3회 해결 후에도 겹치면 마지막 안전 위치에서 멈춘다. 원 대 회전 박스는 박스 로컬 좌표에서 처리한다. 접촉 후 밀어내기만 하지 말고 이동 구간도 검사해 얇은 울타리 관통을 막는다.
- 통행 영역은 섬 polygon 내부에서 물/구멍 polygon을 뺀 뒤 다리 통행 polygon을 합친 영역이다. 원 전체가 영역 안에 남도록 경계 선분과 거리·이동 구간을 검사한다. 섬 밖·물가·모서리에도 같은 미끄러짐을 적용한다. 다리는 물 구멍의 예외이며 섬 밖 통행 허가는 아니다. 충돌을 렌더 메시에서 매 프레임 추정하지 않는다.
- 주 통로 유효 폭 .9m 이상, 좁은 통로도 .6m 이상. NPC 접근 공간을 확보하고 spawn·대화점을 장애물 안에 두지 않는다. 오프라인 도달성 검사에 촘촘한 격자를 쓸 수 있지만 실행 중 이동은 격자에 의존하지 않는다.

### 입력·상호작용·카메라

- 데스크톱: 방향키+WASD를 누르는 동안 이동. blur·visibilitychange·대화 시작 때 입력을 해제한다. 입력창/DOM 버튼에 포커스가 있으면 이동 키를 가로채지 않는다.
- 모바일: **왼쪽 아래 고정 8방향 패드**를 권고한다. 외경 144 CSS px, 중앙 dead zone 18px, 상하좌우 화살표와 대각선 입력. 각 방향 터치 영역은 48px 이상, safe-area + 16px을 확보하고 오른쪽 아래 ‘말하기’와 분리한다. 처음 누른 pointer만 capture하고 드래그로 방향을 바꾼다. up/cancel/lostcapture에서 정지하고 다른 손가락 때문에 이동이 남지 않게 한다. 패드의 touch-action은 none으로 한다.
- 상호작용: 중심 간 거리 .85m 이내이며 벽에 가리지 않은 대상 1개를 표시한다. 최단 거리, 동률이면 id 순으로 선택하고 전환 여유 .1m로 깜빡임을 막는다. 데스크톱 Space/Enter, 모바일 ‘말하기’를 사용한다. 누른 순간 거리·진행 가능 여부를 다시 확인하고 정지·마주보기 후 기존 onInteract(id)를 한 번 호출한다. 진행 불가 대상은 기존 중립 안내를 사용한다. 호수·광장·문도 기존 ID를 유지한다.
- **바닥 탭 자동 이동은 제거**를 권고한다. 연속 조작에 별도 경로 탐색을 병행하지 않고, 먼 NPC를 눌러도 자동으로 걷지 않는다. 가까운 NPC 탭은 말하기 버튼과 같은 검증을 거쳐 허용할 수 있다. UI 터치가 아래 canvas에 전달되지 않게 한다.
- 대화·타이틀·결과에서는 패드/근접 표시를 숨기고 입력을 0으로 만든다. 같은 Space/Enter가 대화 시작과 다음 대사 넘기기를 모두 실행하지 않도록 repeat와 keyup 경계를 처리한다. 이동 조작을 선택지 모양·측정 반응과 연결하지 않는다.
- 카메라는 기존 약35°/45° 정사영·delta time 추적을 유지한다. 주인공은 화면 높이 40% 부근, 추적 계수는 1-exp(-10*dt)를 초기값으로 쓴다. 화면 전체의 지면 투영 범위까지 고려해 경계를 제한하고 바다를 배경색과 연결한다. 좁은 화면에서 패드·얼굴·대화창 겹침을 검사한다. 회전·줌 기능은 추가하지 않는다.

### v2 형식과 변환

다음은 구조 예시 일부이며 완성된 맵이 아니다. 실제 변환에서는 7개 구역, 기존 actor 8개 ID와 lake/plaza/gate 상호작용 ID를 유지한다.

~~~json
{
  "version": 2,
  "spawn": { "x": 6, "z": 10.392 },
  "terrain": { "asset": "terrain", "x": 0, "z": 0, "rot": 0, "scale": 1 },
  "bounds": {
    "outer": [{"x":-18,"z":-16},{"x":18,"z":-16},{"x":18,"z":16},{"x":-18,"z":16}],
    "holes": [],
    "bridges": []
  },
  "zones": {
    "entrance": { "x": 6, "z": 10.392 },
    "plaza": { "x": 0, "z": 0 },
    "bakery": { "x": 8, "z": -3.464 }
  },
  "paths": [{ "width": 0.9, "points": [{"x":6,"z":10.392},{"x":0,"z":0}] }],
  "actors": [{ "id": "A", "asset": "char-a", "zone": "plaza", "x": 0, "z": 0 }],
  "props": [{ "id": "bakery-main", "asset": "bakery", "x": 6, "z": -6.928, "rot": 3.142, "scale": 1 }]
}
~~~

- zones는 자유 좌표의 안내/이벤트 지점이다. actors는 zone 참조와 별개로 위치를 필수로 갖는다. props에 장식도 합치고 충돌은 manifest에서 얻는다. v2에 개별 walk·q/r·dx/dz·기존 model/kind를 남기지 않는다. 지형만 bounds가 충돌 원본이다. outer는 단순 폐곡선, holes는 폐곡선 배열이며 vertices는 x,z 좌표다. bridges 항목은 propId와 points를 갖고 해당 bridge의 위치·방향과 일치해야 한다.
- 변환식은 실제 코드의 HEX=2/√3에서 **x=2q+r, z=√3r**이다. hexSize:1을 실제 반경으로 오해하지 않는다. decor는 x에 dx, z에 dz를 더하며 누락 오프셋은 0이다. actor의 zone 참조는 먼저 해석한다. entrance(0,6)→(6,10.392), s2j2(3,-5)→(1,-8.660). 저장값은 충분한 소수 자릿수를 유지한다.
- scripts/migrate-village-v2.mjs는 v1 입력·v2 출력 경로를 명시하고 같은 입력에서 같은 결과를 만든다. v2 재변환은 무변경이다. 기존 키→새 asset 명시 대응표를 두고 미지원 키는 오류로 처리한다. 옛 팩 배율(medieval 1/city .6/furniture .25/restaurant .12)을 새 GLB에 적용하지 않는다. 위치만 초기 변환하고 실물 치수에 맞춰 scale은 원칙적으로 1로 재설정한다.
- 기존 tiles의 공유 변을 제거해 섬/물 경계를 얻는다. 해안 각을 다듬되 구멍·다리 연결을 보존한다. 통행 불가 coast는 보수적으로 물 쪽 경계로 취급하고 보이는 해안과 맞춘다. props의 기존 ‘한 칸 전체 차단’을 이월하지 않는다. agy는 최종 polygon/paths를 읽어 지형 메시를 만들고 임의의 다른 섬 모양을 만들지 않는다.
- 전 NPC/이벤트 도달성과 .6m 통로를 검사한 뒤 채택하고 위치 조정 내역을 보고한다. 측정 로그·segment·storageKey는 유지한다. 현재 저장에는 player 좌표가 없으므로 새 세이브 마이그레이션을 만들지 않는다.

## 6. 렌더 개선과 성능 예산

방향광 1개의 **실제 그림자 + 자체 AO**를 기본으로 한다. 모바일 shadow map 512², 데스크톱1024², 최대1024². 화면 근처 약8×8m로 그림자 범위를 좁히고 caster가 광원 시야에 들어오는지 확인한다. 캐릭터·가까운 건물/나무만 cast, 지면은 receive, 작은 꽃은 cast하지 않는다. 고정 환경에서도 움직이는 캐릭터 그림자는 갱신한다. PCF를 사용하고 bias는 실제 축척에서 조정해 떠 있는 그림자·줄무늬를 검사한다. 그림자 패스도 대상들을 다시 그리므로 비용에 포함한다. [Three.js 그림자 공식 문서](https://threejs.org/manual/pages/shadows.html)

성능 미달이면 그림자 범위·DPR·배치 밀도를 먼저 줄인다. 그래도 부족하면 실제 그림자를 끄고 같은 자체 AO + 접지 blob을 쓰는 낮은 품질 설정을 사용한다. 방향성 그림자를 지면에 구운 뒤 같은 정적 그림자를 중복 투영하지 않는다. SSAO·Bloom·DOF·동적 반사·복수 그림자 광원은 이번 범위에서 제외한다.

색은 선형 계산→sRGB 출력을 명시하고 brightTexture()의 채도/색상 보정을 제거한다. vertex color는 Linear-sRGB, 컬러 이미지는 sRGB, AO는 non-color다. NoToneMapping을 기준으로 하고 밝은 면이 날아갈 때만 같은 노출에서 ACESFilmicToneMapping 비교안을 제출해 Astra가 하나로 정한다. Blender 렌더만으로 판단하지 않고 게임에서 대표색·음영을 검수한다. [Three.js 색 관리](https://threejs.org/manual/pages/color-management.html)

| 대상 | 예산·검증 |
| --- | --- |
| 초기 다운로드 | 10MiB(10×1024² bytes) 이하. JS/CSS/HTML/ink/JSON 2MiB, 캐릭터1MiB, 환경 키트3MiB, 지형/이미지1MiB, 디코더 등 .5MiB, 여유2.5MiB. 캐시 없이 시작→프롤로그→첫 조작 가능까지 받은 요청을 합산한다. 전송량과 압축 전 리소스 크기를 모두 기록한다. |
| 배포 대상 | 첫 구현은 단일 맵을 예산 안에 담는다. source PNG/.blend/Python은 배포하지 않는다. 옛 KayKit은 소유 범위 밖에서 삭제하지 않고 Vite 배포/빌드 대상에서 제외한다. 현재 check-size.mjs는 dist 전체 검사이므로 초기 요청량과 구분해 둘 다 확인한다. |
| 드로 콜 | 주 패스80 이하, 그림자 포함120 이하/프레임. 같은 geometry/material의 정적 식생·소품은 InstancedMesh, 캐릭터는 개별 skeleton. 구역별로 culling하고 섬 전체를 거대한 한 묶음으로 그리지 않는다. |
| 삼각형 | 주 패스100,000 이하, 그림자 포함150,000 이하/프레임. 개별 GLB 상한과 화면 내 배치 수를 따로 관리한다. |
| 텍스처/GPU | 압축 해제된 텍스처+미프맵32MiB 이하, 그림자/렌더 타깃 별도16MiB 이하 목표. 1024² RGBA8+미프맵은 약5.33MiB. PNG/GLB 파일 크기를 GPU 메모리로 간주하지 않는다. 모바일 DPR 상한1.5, 데스크톱2. |
| 로딩 | GLB/디코더 404·실패를 숨기지 않고 재시도 표시. 필수 지형/캐릭터가 준비될 때까지 이동 금지. 실패한 캐시를 비워 재시도 가능하게 한다. 보이지 않는 장애물만 있는 마을을 시작하지 않는다. |
| 자원 | geometry/material 공유, quest NPC도 로드 결과를 공유하되 SkeletonUtils.clone으로 본을 분리한다. 화면 밖 idle 갱신 중지. 해제 때 공유 자원의 중복 dispose를 피하고 재시도·화면 복귀 뒤 메모리 누적을 확인한다. |

## 7. 병렬 작업 분할

아래는 **구현 착수 승인 후** 전달할 작업이다. 한 행=브랜치/worktree/PR 하나이며 이번에는 생성하지 않는다. 파일은 한 담당자만 소유하고 다른 담당자가 필요한 변경은 소유자에게 요청한다. 기존 역할표보다 이번 사람 지시를 우선한다. Astra가 계획·코드·아트를 리뷰하고 Claude가 결과 회수·수정 지시를 조율한다. 공용 memory/devlog는 작업자가 수정하지 않고 통합 시 문서 정리 작업으로 갱신한다.

| 작업 / 담당·effort | 독점 쓰기 범위 | 의존 관계·완료 기준 |
| --- | --- | --- |
| A1 캐릭터 원본 / agy, 중~높음(작업 난이도) | assets/source/characters/**, assets/source/concepts/characters/**, assets/source/previews/characters/**, client/public/assets/abraxas/characters/** | 컨셉부터 시작. §3의 6종·3클립·크기/충돌 metadata. player/A 선행, 게임 시험 렌더 검수 후 나머지 제작. |
| A2 환경 원본 / agy, 높음(작업 난이도) | assets/source/environment/**, assets/source/concepts/environment/**, assets/source/previews/environment/**, client/public/assets/abraxas/environment/** | 키트 컨셉은 A1/M1과 병렬, 지형은 M1 v2 polygon 확정 후. 건물6·나무4·소품 전체·지형, metadata·원본/미리보기·예산 제출. |
| M1 맵·충돌 / Terra, high | content/world/village.json, content/assets/manifest.json, 신규 client/src/core/world/**, scripts/migrate-village-v2.mjs | §3 키/치수로 계약·v2 먼저 확정해 A2/R1/I1에 전달. 순수 TS 이동·충돌·도달성 테스트와 변환 재실행 안전성. 아트는 계약 준수, 차이는 M1만 manifest 수정. |
| R1 로딩·렌더 통합 / Terra, high | client/src/scenes/**, client/src/main.ts, client/vite.config.ts, client/scripts/check-size.mjs, 신규 client/scripts/check-abraxas-assets.mjs, client/public/assets/abraxas/decoders/** | M1 타입/API 확정 후 구현, A1/A2 완성 후 통합. GLB·그림자·카메라·이동 연결, 옛 에셋 요청0, 크기 검사·4장면 화면·성능 측정. |
| I1 키보드·패드 / Terra, medium | 신규 client/src/input/**, client/src/ui/**, client/src/style.css | 아래 Village API 계약으로 M1/R1과 병렬, 실연결은 R1 후. 8방향·동시 터치·입력 해제·대화 중복 호출·안전 영역 검증, 측정 UI 보존. |

client/src/content.ts, 기존 core/scoring·core/flow, content/scoring·ink·i18n, server, package/lockfile, 기존 아트 문서는 변경 범위 밖이다. 추가 의존성은 없다. 새 입력 라벨은 I1의 작은 한국어/영어 표시 사전에 모으고 기존 언어 선택값을 전달한다.

병렬 연결 계약: 기존 Village.onInteract·setEnabled·setAvailable을 유지한다. R1은 setMoveInput(x: number, y: number): void(화면 오른쪽/위쪽, -1~1), interactNearby(): void, onNearbyChange: (target: { id: string; available: boolean } | null) => void를 제공한다. I1은 Game에서 입력 UI를 소유하며 panel/open/title/result 진입에 입력/표시를 멈추고 showWorld()에서 재개한다. 기존 선택 확정/저장 순서는 바꾸지 않는다. M1은 렌더러/DOM을 import하지 않고 위치·collider·통행 polygon을 받아 위치를 반환한다.

통합 순서: **M1 계약·v2 → A1/A2·R1·I1 병렬 → player/A+광장 시험 렌더 → 전체 키트 → R1 통합 → Astra 리뷰**. 키/치수 변경은 계약부터 다시 확정한다. 미완성 대체 도형을 최종 아트로 승인하지 않는다.

### 검증 책임

M1은 원/회전 박스/물가/다리/모서리 미끄러짐·얇은 울타리·대각선 속도·잘못된 데이터를 소수의 회귀 테스트로 확인한다. I1은 cancel/blur/두 손가락/대화 시작 키 소비를 확인한다. R1은 실제 GLB의 키·존재·삼각형·클립·디코더, 누락 에셋과 일반 입력의 전체 진행을 검사한다. 개발 훅으로 즉시 대화를 호출하는 것만으로 이동 통과를 선언하지 않는다.

통합 환경에서 npm --prefix client run typecheck, npm --prefix client test, npm --prefix client run build, npm --prefix client run check:size, node client/scripts/check-abraxas-assets.mjs를 실행한다. 서버 비변경이어도 규약의 go -C server vet ./..., go -C server test ./..., server를 cwd로 govulncheck ./... 결과를 기록한다. 도구 부재·권한 제한과 테스트 실패를 구분하고 통과로 쓰지 않는다.

이번 문서 작성 시 기존 클라이언트 typecheck와 14개 테스트는 통과했다. 서버 vet/test는 기본 Go 캐시 접근 거부, govulncheck는 실행 파일 부재로 완료하지 못했다. Blender 실행·GLB 제작·빌드·브라우저 조작·실기기 성능은 이번에 검증하지 않았다. 예산은 실측 결과가 아닌 후속 제작 목표다.

## 부록: 작업자에게 그대로 전달할 프롬프트

### A1 — agy 캐릭터

~~~text
너는 Abraxas 원본 캐릭터 담당이다. 모델은 gemini-4-argon-medium.
cwd: C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-characters
AGENTS.md, .agents/rules/game-design-policy.md·delegation.md·security.md, docs/memory/lessons.md, docs/design/asset-control-overhaul.md를 읽어라. 이번 사람 지시와 계획을 옛 2.5등신/KayKit/코드 도형 방침보다 우선한다.

image-generator를 실제로 사용해 원본 컨셉 PNG(정면·측면 턴어라운드·팔레트 칩) 6종을 만든다. 레퍼런스는 ‘둥글고 따뜻한 로우폴리 디오라마’라는 품질·톤만. 기존 게임/애니의 캐릭터·의상·소품을 닮게 지시하거나 기존 에셋을 원본으로 등록하지 마라.
성별 중립 SD3등신, 점 눈+작은 입. A 공형+깃발 #FF7A59, B 물방울형+앞치마 #FFB020, C 원기둥형+큰 머리+둥근 안경 #8E6BFF, D 블록형+넓은 어깨+망치 #14B8A6. player는 얼굴 없는 둥근 몸+반쪽 알 껍질. quest-npc는 회색조+작은 모자로 s1j2 등 4ID가 공유한다.
컨셉을 바탕으로 assets/source/characters/build_characters.py를 작성한다. player/A를 먼저 시험 렌더 가능한 품질로 만들고 검수 후 전체 6종으로 확장한다. 전 캐릭터 idle/walk/talk 제자리 Action을 베이크해 GLB로 내보낸다. 계획 §2~3의 치수·원점·축·Draco·tri/byte 상한을 지키고 실제 export된 클립과 본을 검사한다.
assets/source/characters/asset-metadata.json에 키→path/scale/collision/clips와 실측 tri/bytes/bounds를 기록한다. provenance.md에는 생성 도구·모델·프롬프트·독자적 형태의 이유·실행 Blender 버전을 한국어로 남긴다. GLB는 client/public/assets/abraxas/characters, 미리보기는 assets/source/previews/characters로 쓴다. 게임 코드/manifest는 변경하지 않는다.

headless 허용 실행 명령은 아래 한 문자열뿐이다(PowerShell, 맨 앞 &도 포함해 정확히 일치). cwd는 미리 설정하며 cd/추가 인자/연결/파이프/--python-expr를 쓰지 않는다.
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/characters/build_characters.py

쓰기 허용 디렉터리(write_file에 다음 절대 디렉터리만 등록):
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-characters/assets/source/characters
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-characters/assets/source/concepts/characters
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-characters/assets/source/previews/characters
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-characters/client/public/assets/abraxas/characters

스크립트 출력/임시 베이크도 위 범위 안에 둔다. Blender 스크립트에서 네트워크·외부 프로세스·패키지 설치를 하지 않는다. image-generator 부재/실패나 명령 거부는 구체적으로 보고하고 미생성을 완료로 표시하지 않는다. 다른 명령으로 권한을 우회하지 않는다.
문서/보고는 한국어, 식별자/주석은 영어, UTF-8 패치 도구로 작성. PowerShell Set-Content/Out-File 금지. 커밋·push·PR 생성·memory/devlog 수정 금지. 산출물 목록, 컨셉/GLB 비교, 예산 실측, 미확인 사항을 보고한다. 측정 반응은 중립이며 수치·하트·물음표 연출을 만들지 않는다.
~~~

### A2 — agy 환경

~~~text
너는 Abraxas 원본 환경 아트 담당이다. 모델은 gemini-4-argon-medium.
cwd: C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-environment
AGENTS.md, .agents/rules/game-design-policy.md·delegation.md·security.md, docs/memory/lessons.md, docs/design/asset-control-overhaul.md와 M1의 v2 맵을 읽어라.

image-generator로 원본 컨셉 PNG를 assets/source/concepts/environment에 만든다. 건물/소품별 정면·측면·쿼터뷰와 팔레트 칩을 갖춘다. 기존 게임/애니의 건물·가구·식물·배치를 닮게 만들지 말고 ‘둥글고 따뜻한 로우폴리 디오라마’라는 품질·톤만 참고한다. KayKit을 가공해 원본이라고 부르지 않는다.
계획 §3의 건물6종, 나무4종, 덤불·꽃 화단·잔풀·버섯·자갈·울타리·돌·가로등·벤치·우물·축제 무대·기억의 문·다리·물가3종·생활 소품5종·연속 지형을 만든다. 영문 키/치수/원점/충돌을 지킨다. 잔풀/꽃은 충돌 없음, 나무는 줄기만, 문/다리는 통로를 막지 않는다.
assets/source/environment/build_environment.py를 작성한다. 키트는 선행 가능하지만 terrain은 M1의 content/world/village.json v2 확정 후 읽어 outer/holes/bridges/paths와 일치시킨다. 어귀·광장부터 시험 렌더하고 Astra 검수 후 확장한다. 자체 AO·COLOR_0·최소 아틀라스·Draco·예산은 계획 §2~3을 지킨다.
GLB는 client/public/assets/abraxas/environment, 미리보기는 assets/source/previews/environment로 쓴다. assets/source/environment/asset-metadata.json에 path/scale/collision과 실측 tri/bytes/bounds, provenance.md에 생성 프롬프트/모델/Blender 버전을 기록한다. 맵/manifest/게임 코드는 쓰지 않는다.

headless 허용 명령은 아래 하나뿐이다(PowerShell, & 포함 정확한 문자열). cwd는 위 경로 고정, cd/연결/추가 인자/--python-expr 금지.
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/environment/build_environment.py

쓰기 허용 디렉터리:
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-environment/assets/source/environment
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-environment/assets/source/concepts/environment
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-environment/assets/source/previews/environment
C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-environment/client/public/assets/abraxas/environment

write_file에는 위 절대 디렉터리만 등록한다. 스크립트 출력/임시 파일도 같은 범위에 두며 외부 프로세스/네트워크/설치를 하지 않는다. image-generator 실패나 권한 거부는 미완료로 보고하고 다른 명령으로 우회하지 않는다.
문서/보고는 한국어, 식별자/주석은 영어. UTF-8 패치 도구, Set-Content/Out-File 금지. 커밋/push/PR/memory/devlog 수정 금지. GLB·미리보기·원본 근거·예산 실측·미확인을 보고한다.
~~~

### M1 — Terra 맵·충돌

~~~text
Abraxas 자유 이동 데이터/순수 로직을 구현하라. gpt-6.1-terra, effort high, Ponytail full. 가장 단순한 완전한 구현, 요청 범위 밖 추상화 금지.
AGENTS.md와 game-design-policy/delegation/frontend-phaser/security/cross-platform, docs/design/asset-control-overhaul.md, client/src/scenes/village.ts·decor.ts, content/world/village.json을 읽어라.
쓰기 범위는 content/world/village.json, content/assets/manifest.json, 신규 client/src/core/world/**, scripts/migrate-village-v2.mjs뿐이다. 기존 scoring/flow, UI, scenes, 아트, package는 변경하지 않는다.
계획 §3의 키/실측 기준 치수로 manifest와 v2 타입/데이터를 먼저 확정해 A2/R1/I1에 전달한다. x=2q+r, z=sqrt(3)r, decor 오프셋과 actor zone을 해석하고 v2 재실행은 무변경으로 처리한다. 기존 props 한 칸 차단과 팩 배율은 이월하지 않는다. 섬 밖/물/다리를 polygon으로 만들고 7zone·8actor·이벤트 ID를 유지한다. 미지원 asset/비유한값/잘못된 polygon을 거부한다.
원형 player와 원/회전 박스/경계의 연속 이동·접촉 미끄러짐을 순수 TS로 구현한다. DOM/Three.js import 금지. 대각선 정규화·delta time·얇은 울타리·물가·문/다리·모서리·통로·전 대상 도달성을 소수의 의미 있는 테스트로 검사한다. 실행 중 격자/BFS 이동은 제거한다.
아트 metadata와 차이는 manifest 소유자로서 대조한다. 계약 변경이 필요하면 임의로 확장하지 않고 Astra 리뷰를 거쳐 담당자에게 알린다. 측정 로그/저장 형식/가중치/문구/순서를 바꾸지 않는다.
UTF-8 패치, Set-Content/Out-File 금지. 문서/보고는 한국어, 식별자/주석은 영어. typecheck/test 결과·좌표 조정·미확인을 보고한다. 커밋/push/PR 생성/memory/devlog 수정 금지.
~~~

### R1 — Terra 로딩·렌더 통합

~~~text
Abraxas GLB/자유 이동/렌더를 통합하라. gpt-6.1-terra, effort high, Ponytail full. 가장 작은 완전한 변경, 추가 의존성/범위 밖 추상화 금지.
AGENTS.md, game-design-policy/delegation/frontend-phaser/security, docs/design/asset-control-overhaul.md, client/src 전체, M1 타입/manifest/v2, A1/A2 metadata를 읽어라. Three.js는 설치된 타입과 공식 API를 확인한다.
소유 범위: client/src/scenes/**, client/src/main.ts, client/vite.config.ts, client/scripts/check-size.mjs, 신규 client/scripts/check-abraxas-assets.mjs, client/public/assets/abraxas/decoders/**뿐이다. 다른 JSON/UI/아트/source/package/lockfile을 수정하지 않는다.
M1 로직을 호출하고 hex/BFS/옛 팩 배율/brightTexture/코드 조립 캐릭터·소품/중복 자동 식생을 제거한다. manifest GLB를 캐시하고 캐릭터의 본을 분리해 3클립을 재생한다. 지형·충돌·렌더 좌표를 맞춘다. 기존 Village.onInteract/setEnabled/setAvailable을 유지하고 계획 §7의 setMoveInput/interactNearby/onNearbyChange를 I1에 제공한다. 근접 재검증·벽 가림·대화 전 정지·단발 이벤트를 담당한다.
GLTFLoader+DRACOLoader는 설치된 Three.js와 동봉 디코더를 사용해 같은 출처에서 제공한다. main/scenes에 재시도 가능한 로딩 상태를 만들고 실패를 숨기지 않는다. 옛 KayKit은 삭제하지 않고 dev/production 배포 대상에서 제외하며 초기 요청에 남지 않는지 확인한다.
방향광 실그림자·자체 AO·색 관리·화각/추적·GPU 예산은 계획 §6을 따른다. player/A+어귀/광장의 실제 화면부터 제출하고 통과 후 전체 키트를 통합한다. 스크린샷뿐 아니라 키보드/실제 터치로 대화·전체 동선을 검증한다. 낮은 품질의 그림자 off/접지 blob도 검사한다.
에셋 검증 스크립트는 실제 파일/tri/clip/bytes와 manifest 참조를 검사하며 손상 GLB/누락 clip을 잡는 작은 self-check를 둔다. typecheck/test/build/check:size, 초기 요청량, 4장면 캡처, 실기기 fps/메모리를 보고한다. 실기기가 없으면 미확인이라고 쓰며 통과로 처리하지 않는다.
UTF-8 패치, Set-Content/Out-File 금지. 문서/보고는 한국어, 식별자/주석 영어. 측정/저장/서버 API는 수정하지 않는다. 커밋/push/PR 생성/memory/devlog 수정 금지.
~~~

### I1 — Terra 입력·UI

~~~text
Abraxas 키보드/모바일 패드를 구현하라. gpt-6.1-terra, effort medium, Ponytail full. 추가 의존성과 범용 입력 프레임워크를 만들지 않는다.
AGENTS.md, game-design-policy/delegation/frontend-phaser/security, docs/design/asset-control-overhaul.md, client/src/ui/game.ts·style.css와 Village 공개 API를 읽어라.
소유 범위는 신규 client/src/input/**, client/src/ui/**, client/src/style.css뿐이다. scenes/main/core/content/아트/package를 수정하지 않는다. R1의 계획 §7 API를 사용하고 Game에서 패드/키보드 연결을 소유한다.
방향키+WASD의 화면 기준 이동, 왼쪽 아래144px 8방향 패드, 오른쪽 아래 ‘말하기’/Space/Enter를 구현한다. 한국어/영어 지원, 48px 타깃, safe-area, 중앙 dead zone, pointer capture, 두 손가락, cancel/lostcapture/blur/visibilitychange 해제를 충족한다. 대화/타이틀/결과에서 숨기고 입력을 0으로 하며 복귀 후 눌림이 남지 않게 한다.
근접 대상만 안내하고 원거리 자동 이동을 새로 만들지 않는다. repeat/키 해제 경계/포커스를 처리해 대화 시작과 대사 넘기기의 중복 호출, UI에서 canvas로 터치 전달을 막는다. 선택 저장→반응 순서, 동등한 선택지, 중립 반응, 글자 확대를 보존한다. 기존 save 문제를 이 변경에 섞지 않는다.
입력 해제/동시 입력/대화 시작 키 회귀를 작게 테스트하고 360×640/390×844에서 패드·NPC·대화창 겹침과 터치 조작을 확인한다. typecheck/test와 미확인을 한국어로 보고한다.
UTF-8 패치, Set-Content/Out-File 금지. 코드 식별자/주석은 영어. 커밋/push/PR/memory/devlog 수정 금지.
~~~

각 agy 권한은 Claude가 실행 전에 command(위의 정확한 문자열)와 열거한 write_file(절대 디렉터리)를 등록한다. command(blender *)나 --mode auto로 넓히지 않는다. 명령 문자열이 달라지면 허용 등록도 새 고정 문자열에 맞춰야 한다. 이번에는 Blender를 실행하거나 권한 설정을 변경하지 않았다.
