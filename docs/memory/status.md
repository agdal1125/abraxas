# 현재 상태

마지막 갱신: 2026-10-31

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
- [ ] 다음: 소품 색 바램 보정, 섬 외곽선 자연화(육각형), 원근 카메라 비교안, 장소 씬, 시계 조명(P2), 결과 연출, 실기기 성능 측정
- [ ] 다음: B·C·D·막간·축제 ink 대사, 퀘스트 NPC 고유 대사, 고백 장면, 실제 폰(iOS 사파리·안드로이드·카카오톡 인앱) 성능 확인, 서버 결과 저장

## 열린 질문

- 16유형 이름·일러스트 (추후)
- 광고 노출 위치 (H5 Games Ads 승인 필요)
