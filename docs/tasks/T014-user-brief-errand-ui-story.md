# T014 사람 요청 원문 — 심부름 계획·UI/UX 검토·폰트·시나리오 (2026-11-02)

> Start Astra on the errand plan. Meanwhile, review the UI and UX button of the current game and let agy cli to choose the most appropriate font that supports both Korean and English. After the review of UI and UX, deletage the task to parallel agent using Codex Terra 6.1. Also make agy Argon4 work on the overall scripts and write game scenario.

## 감독 메모
- 심부름 = docs/roadmap/next-agenda.md 2단계 "모카의 빵 심부름".
- agy Argon4는 사용량 한도(429, 약 115시간 후 재설정). 정책(.agents/rules/delegation.md)과 사람의 이전 지시("agy 한도에 걸렸으면 그냥 Codex 를 하나 더 사용해")에 따라 폰트 선정·시나리오 작업은 Codex gpt-6.1-terra가 대신한다.

## 사람 결정 (2026-11-02, 에이전트 질문에 대한 답)
- 모카 빵 배달처: **기존 오르의 대장간** 바깥 받침대 사용, 공방으로 오르는 두 길만 작게 보완(Astra 추천안). 오르 에피소드·호감도는 시작하지 않고 빵 진열은 빵집에서.
- 기존 브라우저 저장 기록: **지우지 않고 '로컬 체험'으로 보존**, 서버 저장은 새 회차부터(Astra 추천안).
- 결말에서 주인공의 기억과 마을의 정체: **암시만 하고 열어 둔다**(마을이 주인공 마음의 꿈같은 반영임을 직접 말하지 않음).
- 대화 중 화자가 멀리 있을 때: **배율 유지, 화자를 우선**해 잡는다(캐릭터 60~80px 유지, 플레이어는 일부 화면 밖 가능).
