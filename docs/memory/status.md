# 현재 상태

마지막 갱신: 2026-10-31

## 단계

- [x] 기획서 v2.0 (Claude 문서, 노션 사본)
- [x] 기술 스택 결정 (ADR-0001)
- [x] 에이전트 사전 세팅 (AGENTS.md, .agents/rules, .agents/skills, docs/memory)
- [ ] 개발 환경 세팅: Node 22+, Go 1.27, inklecate, Firebase CLI, gcloud
- [ ] Phaser 공식 스킬 설치 (`npx skills add phaserjs/phaser`)
- [ ] 클라이언트 뼈대 (`npm create @phaserjs/game@latest`, TypeScript + Vite)
- [ ] 서버 뼈대 (Go, `/healthz`, 토큰 검증 미들웨어)
- [ ] 성향 데이터 스키마(`content/scoring/items.json`) + 골든 테스트
- [ ] 수직 슬라이스: 프롤로그 + 에피소드 1개 + 결과 카드

## 열린 질문

- 16유형 이름·일러스트 (추후)
- 광고 노출 위치 (H5 Games Ads 승인 필요)
- 보조축 E의 NPC별 스타팅 값
