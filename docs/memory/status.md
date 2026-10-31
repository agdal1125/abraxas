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
- [ ] 성향 계산 코어 + 골든 테스트
- [ ] 수직 슬라이스: 프롤로그 + 에피소드 1개 + 결과 카드

## 열린 질문

- 16유형 이름·일러스트 (추후)
- 광고 노출 위치 (H5 Games Ads 승인 필요)
