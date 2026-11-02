# 현재 상태

마지막 갱신: 2026-11-03

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
- [ ] ER1-E: 익명 인증·App Check·Firestore 구현, 감독 ko/en 에뮬레이터 E2E·트랜잭션 검증 통과(codex/firebase-er1e). 초기 JS +1,718바이트 허용 답변·CI 대기, main 미병합. 원본 er4/env 보존
- [ ] 진행 중: 루미·에코·오르 생활 문제(계획 #43). 3dviz 스킬 적응·캐릭터/NPC 개선 제안 작성, 외관 구현은 사람 승인 대기. 휴대폰·공식 결과 저장은 후속
- [ ] 다음(T010): 행동형 퀘스트(모카 운반·진열부터), 측정 38문항 행동 매핑, 고백 이유 선택·성찰 결과 카드, 축제 마무리 편들기, 실기기 확인
- [ ] 다음: B·C·D·막간·축제 ink 대사, 퀘스트 NPC 고유 대사, 고백 장면, 실제 폰(iOS 사파리·안드로이드·카카오톡 인앱) 성능 확인, 서버 결과 저장

## 열린 질문

- 16유형 이름·일러스트 (추후)
- 광고 노출 위치 (H5 Games Ads 승인 필요)
