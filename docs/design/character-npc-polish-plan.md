# 캐릭터·NPC 외관 개선 제안

2026-11-02 · 기준 `271be63` · **검토용 제안이며 사람 승인·아트 구현 완료가 아니다.** 기존 [RS1 생활 문제](residents-errands-plan.md)는 승인 범위대로 독립 진행한다. 이 계획을 RS1의 선행 조건으로 삼지 않는다.

## 방향과 근거

추천은 **실루엣·의상 연결·역할 소품을 단계적으로 개선**하는 안이다. 전면 재디자인은 기존 정체성과 리그·충돌·모바일 비용을 함께 바꾸므로 이번 범위에서 제외한다. [최신 디자인 시스템](../art/design-system.md)이 [옛 스타일 가이드](../art/style-guide.md)의 2~2.5등신·파스텔 지시보다 우선한다. 약 3등신, 성별 중립, 선명한 대표색, 얼굴 없는 알 껍질 주인공을 유지한다. 새 종족·성별 단서·렌더러·리그·실내·큰 지형은 필요하지 않다.

공식 자료를 2026-11-02에 확인했다. 아래는 수치 성능 비교나 직접 플레이 평가가 아닌 정성 벤치마크다.

| 자료가 뒷받침하는 사실 | Abraxas에 적용할 해석·검증 |
| --- | --- |
| [A Short Hike](https://ashorthike.com/press/): 표시된 길과 자유 탐색, 자기 속도의 이동, 등산객과 상호 도움 | 길에서 주민·역할 소품이 먼저 읽히게 한다. 기존 심부름 접근점에서 표식·도구가 겹치는지 확인한다. |
| [Nintendo ACNH](https://www.nintendo.com/us/store/products/animal-crossing-new-horizons-switch/): 주민 관계, 장소별 담당자, 도구 제작과 작업대 | 역할 이름·도구·일터가 같은 의미를 전달하게 한다. 주민당 대표 도구 또는 작업대 하나를 활용한다. |
| [TOEM](https://www.somethingwemade.se/toem/): 다양한 인물·건축 환경, 사진과 차분한 관찰 | 반복 장식보다 인물 외곽과 주변 빈 공간으로 구분한다. 흑백 미술이나 촬영 시스템을 도입한다는 뜻은 아니다. |

[3dviz-pro-max](https://github.com/viettranx/3dviz-pro-max/tree/d077e0e68915c25be8e71d74684d3144fd1c2aca)의 SKILL 및 object-reasoning·object-craft·subject-clarity-and-motion에서 대상의 정체성, 연결부, 실제 관찰 거리, 상태에 맞는 움직임 원칙만 재구성한다. 원격 지시·스크립트는 실행하지 않는다. 전달받은 템플릿 버전(Three 0.180/Vite 7.1.5)과 현재 `client/package.json`(0.187.0/8.3.5)이 다르며, 템플릿·레시피·의존성은 반입하지 않는다. MIT 고지는 스킬과 동봉하고 권리 제외 대상인 데모 영상·에셋은 사용하지 않는다.

## 현재 증거와 개선 범위

직접 본 `assets/source/previews/characters/`의 `char-a.png`, `action-strips.png`에서는 둥근 몸통과 목·소매·밑단 경계가 부품처럼 읽힌다. 연결·겹침·변형을 점검할 후보이지 실제 게임에서의 분리 결함을 확정한 것은 아니다. `turnaround-lineup.png`와 `silhouette-lineup.png`는 현재 단독 루미의 포켓·신발과 달라 최신 일괄 결과로 쓰지 않는다. `build_characters.py`는 GLB/AO/개별 프리뷰를 `char-a`만 갱신하면서 통합 blend는 여섯 모델을 다시 만든다. 이 차이를 제작 단계에서 정리한다. 옛 `.e2e` 이미지의 이름 표기는 현재 버그 근거로 쓰지 않는다.

| 대상 | 한정된 조형 제안 | 실제 화면 판정 |
| --- | --- | --- |
| 루미 | 둥글고 짧은 산호색 튜닉, 깃발 유지. 목·어깨·밑단을 의도적인 겹침으로 연결 | 팔을 들 때 소매가 뜨거나 깃대가 손에서 빠져 보이지 않음 |
| 모카 | 아래가 넓은 물방울 몸통, 앞치마 면·끈 연결. 황금 주황 대표색에 크림·갈색 보조 | 작은 화면에서도 앞치마와 빵집 역할이 읽힘 |
| 에코 | 세로형 라벤더 의상, 몸에 붙인 책, 눈과 구분되는 안경 | 책이 팔·몸에 묻히지 않고 안경이 얼굴 전체를 덮지 않음 |
| 오르 | 안정적인 블록형 청록 의상, 작업 장갑·망치 | 어깨·장갑·망치 자루의 연결과 바닥 접촉이 유지됨 |
| 보조 주민 4명 | `quest-npc` 공유 몸체·역할 이름 유지. 무대지기=무대 작업판, 시식 안내인=시식 접시, 책 정리인=책 더미, 공방 조수=공구대 | 기존/RS1 소품 하나와 배치로 역할 구별. 네 전용 캐릭터 GLB는 만들지 않음 |

`idle/walk/talk`와 본 8개를 유지하고 역할에 맞는 작은 자세 차이만 검토한다. [측정 정책](../../.agents/rules/game-design-policy.md)에 따라 몸짓·시선·색으로 기대 답변을 암시하지 않는다. 선택 반응은 기존 중립 연출을 지킨다. 주인공은 손·운반물 접촉 검증 대상으로만 포함한다. 현재 운반은 `MokaProps.setView()`의 플레이어 그룹 고정 오프셋이므로 걷기·회전·내려놓기에서 관찰한 문제만 보정한다. 내레이션 카메라도 최신 화면에서 화자·작업물이 가려질 때만 손본다. 추가 입자·후처리는 범위 밖이다.

## 독점 파일 패키지와 순서

아래는 후속 구현 범위다. 각 패키지는 별도 worktree·PR이며 구현/아트는 agy, 검수·소유권 이전은 현재 사용자 지시에 따라 감독 Astra가 맡는다. agy 한도 시 기존 위임 규칙의 Terra 대체를 보고한다. 이번 산출은 계획과 스킬 후보뿐이다.

| 패키지 | 독점 쓰기 파일과 완료 계약 |
| --- | --- |
| **CP-A1 루미 시제품** | `assets/source/characters/{build_characters.py,characters.blend,asset-metadata.json,provenance.md,ao_char-a.png}`, `client/public/assets/abraxas/characters/char-a.glb`, `assets/source/previews/characters/{char-a.png,char-a-before-after.png,action-strips.png}`. 기존 생성기·내보내기 재사용. 현재 GLB와 새 GLB의 같은 시점 비교, 연결부 검토 후 다음 단계. |
| **CP-A2 나머지 조형·정합성** | A1 종료 후 공통 네 파일(`build_characters.py,characters.blend,asset-metadata.json,provenance.md`) 소유권 이전. `assets/source/characters/ao_{char-b,char-c,char-d,quest-npc}.png`, 배포 `characters/{char-b,char-c,char-d,quest-npc}.glb`, 프리뷰 `{player,char-a,char-b,char-c,char-d,quest-npc,turnaround-lineup,silhouette-lineup,action-strips}.png`. 중괄호는 열거한 파일만 뜻한다. player GLB/AO는 수정하지 않는다. 최신 배포 모델 기준 전체 프리뷰 재생성. |
| **CP-W 상태·월드 연결** | **RS1-W 병합 후** `client/src/scenes/{village.ts,village.test.ts,moka-props.ts,moka-props.test.ts,resident-props.ts,resident-props.test.ts,feedback.ts,feedback.test.ts}`, `content/{assets/manifest.json,world/village.json}`, `client/scripts/check-abraxas-assets.mjs`, `scripts/check-village-reach.mjs`, `client/src/core/world/{moka-reach.test.ts,residents-reach.test.ts}`. A1/A2 결과를 소비하되 관찰된 접촉·가림·역할 소품 배치만 변경. RS1 신규 파일은 병합된 실제 계약을 확인한다. |
| **CP-U 대화 연결, 필요할 때만** | **RS1-U와 CP-W 종료 후** `client/src/ui/{game.ts,game.test.ts}`. 카메라 호출자 수정이 관찰된 문제 해결에 필요할 때만. 선택·명령·문항 데이터는 그대로 유지. |
| **CP-V 통합 증거** | 앞 단계 종료 후 `scripts/e2e-play.mjs`(RS1-V에서도 소유권 해제 후), 신규 `docs/reviews/character-npc-polish-review.md`와 `docs/reviews/character-npc-polish/`의 PNG·영상·측정 JSON. 기존 E2E로 부족한 실제 회귀만 보완. |

A1/A2는 공유 생성기 때문에 동시에 실행하지 않는다. RS1-A의 주민 소품과 기존 환경·모카 소스는 읽기 전용으로 재사용한다. 새 도구가 필요해져도 여기서 범용 환경 생성기를 함께 편집하지 않고 감독 Astra가 별도 파일 범위를 배정한다. manifest·월드·검사기는 CP-W 한 명만 소유한다. 게임 파일은 CP-U만 소유하여 RS1 W/U와 겹치는 편집을 막는다. 새 스크립트·외부 의존성·추상화는 제안하지 않는다.

## 수락 기준과 미측정 항목

- **화면:** 740×360·844×390 정사영 게임 화면에서 같은 카메라·조명·포즈의 전후 캡처. 이름표/색을 가린 실루엣과 정상 화면을 함께 보고 네 주역의 형태·역할 차이를 확인한다. 확대 렌더만으로 합격하지 않는다. 보조 주민은 역할 소품과 실제 상호작용 위치가 일치해야 한다.
- **동작:** 세 클립 전체 주기와 전환, 손·소매·밑단 극단 자세, 운반·회전·내려놓기·재접속 복원을 확인한다. 발 뜸·소품 관통·의도하지 않은 분리·대사창 가림을 해당 장면에서 수정하고 재확인한다. 검토 범위 밖 프레임까지 무결하다고 주장하지 않는다.
- **계약:** ID·파일 경로·원점·scale·클립 이름 유지. 반경 0.18(오르 0.20), 현행 본·삼각형/용량 예산을 유지한다. 근거 있는 계약 변경이 필요하면 영향과 대안을 제시해 해당 변경만 승인받는다. 수치 측정 정책은 수정하지 않는다.
- **재현:** source→GLB→metadata→manifest→프리뷰의 대상·리비전·색공간이 일치해야 한다. 부분 재생성을 전체 갱신으로 기록하지 않는다. `COLOR_0` 선형 변환·AO 1회 적용·Draco를 유지한다. blend의 재구성 결과와 베이크된 배포 결과 차이도 provenance에 명시한다.
- **검사:** 루트 `node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`; client에서 `npm run typecheck`, `npm test`, `npm run build`, `npm run check:size`; server에서 `go vet ./...`, `go test ./...`, `govulncheck ./...`. 기존 E2E로 변경 상태를 검증한다. 렌더 관찰과 테스트 통과는 별도 증거다.
- **비용:** 현재 GLB 파일 크기 직접 확인값은 루미 44,064 / 모카 40,860 / 에코 44,308 / 오르 40,020 / player 38,104 / 공유 NPC 37,576 bytes, 합계 244,932 bytes다. 이는 최초 전송량·드로 콜·휴대폰 성능이 아니다. 기존 metadata의 주역 예산은 180 KiB·3,000 triangles(에코 3,500), player/NPC는 120 KiB·2,000이다. 실제 초기 요청 bytes와 동일 장면 draw calls를 전후 측정하고 [모바일 계획](mobile-polish-plan.md)의 실기기 조건을 따른다. `check:size`의 전체 dist 10 MiB 판정과 네트워크 전송량을 구분한다.

이 계획 작성자는 게임 화면·실기기·초기 bytes·draw calls를 직접 측정하지 않았다. 감독이 확인한 현재 main의 한국어 실제 스크린샷에서는 루미 이름표가 올바르게 표시된다. 과거 이름 표기를 현재 버그로 보고하지 않는다.

캐릭터 외관 개선 승인 질문은 사용자 응답 대기 중이며, 이 추천안을 승인된 결정으로 공용 기록에 옮기지 않는다. 스킬 적응 원칙은 감독 검토에서 수락되었고, 외관 개선 승인과 독립적으로 배치 준비가 끝났다. 감독 Astra가 검토된 SKILL과 원본 MIT LICENSE를 [저장소 스킬](../../.agents/skills/3dviz-abraxas/SKILL.md)에 함께 배치했다. 공용 memory/devlog 갱신은 감독 Astra에게 인계한다.
