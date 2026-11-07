# 현재 상태

마지막 갱신: 2026-11-07

## 단계

- [x] 기획서 v2.0 (Claude 문서, 노션 사본)
- [x] 기술 스택 결정 (ADR-0001)
- [x] 에이전트 사전 세팅 (AGENTS.md, .agents/rules, .agents/skills, docs/memory)
- [x] macOS·Windows 병행 작업 세팅 (ADR-0003)
- [x] 개발 환경 세팅: Node 22+, Go 1.27, agy → `npm run setup` (Firebase CLI·gcloud는 배포 단계에서)
- [x] Phaser 공식 스킬 설치 (`npx skills add phaserjs/phaser`)
- [x] T003 서버 뼈대 (Go, `/healthz`, 토큰 검증 미들웨어, 로컬 실행) — 담당 agy, 검수 Claude (`docs/tasks/T003-server-skeleton.md`) · 승인, main 병합(#7)
- [x] T004 클라이언트 뼈대 (Phaser 4 + TS + Vite, 로컬 실행) — 담당 agy, 검수 Claude (`docs/tasks/T004-client-skeleton.md`) · 승인, main 병합(#8)
- [x] CI 워크플로 무효 오류 수정 (#6)
- [x] 성향 데이터 형식(`content/scoring/SCHEMA.md`) + 검증 스크립트(`npm run check:scoring`)
- [x] T001 측정 문항 설계 — 담당 agy, 검수 Claude (`docs/tasks/T001-measurement-items.md`) · 승인, main 병합(#5)
- [x] T005 성향 계산 코어 + 골든 테스트 (TS·Go 일치) — 담당 Codex, 검수 Claude (`docs/reviews/T005-review.md`)
- [x] 1차 프로토타입(2D 대사창) — 사람 피드백으로 폐기: 미연시처럼 보이고 마을 탐색·퀘스트가 없음
- [x] 2차 프로토타입: Three.js 정사영 쿼터뷰 3D 마을(KayKit CC0), 탭 이동, 공략 A·B·C·D + 퀘스트 NPC(s1j2 등), 프롤로그 → 에피소드(캐릭터→퀘스트 NPC→복귀)×4·막간(호숫가) → 축제 → 기억의 문 → 결과. `npm --prefix client run dev` (#16~#19, 계약서 `docs/design/village-3d-contract.md`)
- [x] 디자인 시스템 v1: 동물의 숲 디자인 원칙을 토큰·컴포넌트로 시스템화 + 측정 정책 튜닝(`docs/art/design-system.md`), 줌인·말풍선 UI·섬 반영
- [x] 품질 개선 1차(리뷰 docs/reviews/2026-11-01-quality-review.md P0~P1): 연속 지면·흙길, 장식 586 + 자동 식생, 접지 그림자, 바다, SD 캐릭터(손발·점 눈·대기/걷기/대화 동작), UI 접근성(안전 영역·48px·대비 4.5:1·글자 크기)
- [x] 에셋·조작 전면 개편(docs/design/asset-control-overhaul.md): agy가 image-generator 원본 컨셉 → Blender로 캐릭터 6종·환경 키트 38종·섬 지형 GLB 제작, 맵 v2 자유 좌표, 자유 이동·충돌, 방향키·WASD·모바일 8방향 패드·말하기 버튼, 실제 그림자, 옛 KayKit 배포 제외
- [x] 남은 문제 수정(#28): 정점 색, 자연 해안선, 측정 기반 조명, 모바일 에뮬레이션 성능(배포 빌드 FCP 1.84초·1.08MiB)
- [x] 몽환 1차(T010): 사물 살펴보기 29종·구역 안내판 7, 섬 알 모양 실루엣, 몽환 파스텔 팔레트 v2(사람 피드백 반영), 하늘·안개·꽃잎·반딧불·글로우 연출
- [x] 가로 화면 전환(T011): 레이아웃·지형·에셋·조명(#30), 화면 정책 가로 우선 반영(#32), 어귀 구도 2차(F1)
- [x] 실기기 피드백 5건(T013): 첫 화면 버벅임 완화(로딩막·사전 준비), 꽃잎·눈 월드 고정, 화면 꽉 채우기·전체 화면·홈 화면 추가 안내, 살펴보기 버튼 제거·탭 상호작용·자동 이동(경로 탐색), 숨김 조이스틱
- [x] UI·UX 개선(T014): 지금 할 일 칩·화면 밖 방향 표시, 화자 이름표·대화 카메라, 탭·목적지 고리, 게임 안 설정 메뉴, 가로 결과 카드·공유, Pretendard 글꼴(조각 로딩, 첫 화면 글꼴 약 236KB), 제목·로딩·회전 안내 정리
- [x] 시나리오 문서(docs/story/scenario.md)·프롤로그·A 에피소드 대사 다듬기, 영문 문항을 한국어 원문에 맞춤
- [x] 모카 빵 심부름(ER1, #39·#40·이번 PR): 서버 회차·명령 API(인메모리 저장), 모든 측정 선택을 서버가 확정, 심부름 전 단계(길 선택→바구니→배달→장부→진열 퍼즐→나눔→주문→복귀→보고), 소품 9종, 대사 ko·en, 로컬 체험 보존, 저장소 E2E `npm run e2e:play`
- [x] 화면 이름 교체: 루미·모카·에코·오르, 무대지기(s1j2)·시식 안내인(v1j2)·책 정리인(t1p2)·공방 조수(s2j2). 내부 ID 불변, 노출 검사 check-visible-names.mjs
- [x] 다른 주민 생활 문제 계획(docs/design/residents-errands-plan.md, #43), E2E 기본 출력 .e2e/(#42)
- [x] ER1-E(PR #46): 익명 인증·App Check·Firestore, 감독 ko/en 에뮬레이터 E2E·트랜잭션 검증. 초기 JS 125,711바이트 감소·실제 첫 화면 지연 로딩 확인. 원본 er4/env 보존
- [x] RS1(PR #55): 루미·에코·오르 운반·퍼즐·마지막 보고·ko/en 대사·19종 소품. 감독 한/영 6회 전체 E2E·24개 재개 지점·64개 화면 조합 통과(검수 docs/reviews/RS1-review.md)
- [x] T015 챕터별 시나리오(PR #56): docs/story/chapters/ 12개 파일. Prelude(하늘에서 떨어진 알·하얀 주인공·안내견 데미) → 챕터 0(우체부) → 광장 → 네 에피소드 → 막간 3 → 축제 → 기억의 문 → 고백·결과. 측정 38+4 배치·문구 유지, 인물별 말투 규칙, 대사 2줄 이내. 검수 docs/reviews/T015-review.md
- [x] 3dviz 적응 스킬·공식 자료 기반 캐릭터/NPC 개선 제안(PR #45)
- [x] 캐릭터 외관 다듬기(T017, PR #61·#62): 루미·모카·에코·오르에 머리 실루엣과 대표색 목, 역할 소품 가독성, 보조 주민은 얼굴·목만. 게임 크기 740×360 앞뒤와 네 주역의 대화 화면 확인. 전체 동작 주기·실기기는 미확인
- [x] 시나리오 입구 문서를 chapters 기준으로 정리(#59), 게임 안 음악 출처 표기(#60), GitHub Actions 메이저 버전 올림(#1~#4)
- [x] T016 시나리오 게임 이식: 시네마틱 영상 자리(영상 없으면 대체 카드)·데미 동행(절차적 메시, lead/follow/sit/gate/ending)·하얀 주인공·우체부 이름 입력·프롤로그·광장·에피소드 문항별 knot·막간·축제·축제 동행(서버 +10)·기억의 문·데미 이름 공개·고백 이유·서버 고백 판정(60)·결과 카드 3장·처음의 나 저장·마지막 길. 한/영 대사 302줄, 42문항별 반응. E2E ko/en 끝까지 통과(docs/reviews/T016-review.md)
- [x] 오프닝 영상 납품: client/public/cinematics/prelude-v1.mp4 (51초, 720p, 11.7MiB). 용량 기준은 게임 10MB와 영상 13MB로 분리
- [ ] 다음: 실기기에서 영상 재생 확인, 음악의 개별 출처 URL을 credits에 추가
- [ ] 다음: 결과 카드 화면 디자인 다듬기
- [ ] 다음: 실제 폰(iOS 사파리·안드로이드·카카오톡 인앱) 성능 확인, 실제 App Check·운영 저장·배포

- [x] T018 환경 각진 저폴리 전환(#67, 심부름 소품·길 연결 후속 PR): 환경 자산, 지형, 조명, 심부름 소품. 사람 승인 후 병합
- [x] 오프닝 영상 재제작: client/public/cinematics/prelude-v2.mp4 (51초, 720p, 12.4MiB). Blender Cycles, 원본 assets/source/cinematics/prelude-v2/, 렌더 scripts/render-prelude.mjs. 소리는 v1 그대로
- [x] 오프닝 영상 v3: client/public/cinematics/prelude-v3.mp4 (51초, 720p, 12.5MiB). 흐름 v1, 그림 v2, 새 저폴리 강아지, 제목 v1 글꼴. 원본 assets/source/cinematics/prelude-v3, v1 원본 저장소 agdal1125/abraxas-opening
- [x] 게임 속 데미를 영상 강아지 설계로 교체, 목줄 제거
- [ ] 다음: 오프닝과 새 데미를 실기기와 실제 플레이 화면에서 확인
- [ ] 나중: 오프닝 알 낙하가 바닥 앞에서 느려져 떠 보인다는 피드백 반영. 제안은 베지어 대신 Quadratic Ease In. v3 알 높이는 키프레임이 아니라 build_film.py의 egg_fall 수식이라, 카메라(shot_hit)를 포함해 원인부터 확인
- [ ] 다음: 인물 표현을 환경에 맞출지, 실기기 성능, 소리·챕터별 빛 변화(정책 P4)
- [x] 대사 글자 17px, 대사 글꼴 미리 받기(#66), 그래픽·몰입 정책(#65)

## 열린 질문

- 16유형 이름·일러스트 (추후)
- 광고 노출 위치 (H5 Games Ads 승인 필요)
