# Abraxas (가제)

기억을 잃은 내가 30분 동안 마을 사람들과 지내며, 선택으로 '진짜 나'를 되찾는 모바일 웹 심리 테스트형 연애 어드벤처.

- 기획: [docs/gdd](docs/gdd/README.md)
- 기술 스택: [ADR-0001](docs/adr/0001-tech-stack.md) · 에이전트 도구: [ADR-0002](docs/adr/0002-agent-tooling.md)
- 에이전트 지침: [AGENTS.md](AGENTS.md)

## 구조

```
client/    Phaser 4 + TypeScript + Vite
server/    Go API (Cloud Run)
content/   ink 대사, 성향 가중치 데이터
docs/      기획, ADR, 공유 메모리, 개발 일지, 아트 가이드
.agents/   에이전트 규칙(rules)과 스킬(skills)
```

## 처음 세팅

```bash
# 1. 도구
#    Node 22+, Go 1.27.x, inklecate, Firebase CLI, gcloud, Antigravity CLI(agy)

# 2. Claude Code용 스킬 링크 (Antigravity는 .agents/를 바로 읽음)
./scripts/link-agent-config.sh

# 3. Phaser 공식 에이전트 스킬
npx skills add phaserjs/phaser

# 4. Antigravity 실행 (저장소 루트에서, 처음엔 작업 폴더 신뢰 승인)
agy
```

Antigravity에서 권장 플러그인은 앱의 Customizations › Plugins 또는 `agy plugin install <이름>`으로 설치한다. 목록은 ADR-0002.

## 작업 흐름

1. 작업 전: `docs/memory/status.md` 확인
2. 구현 → 테스트 → PR (목적 하나당 PR 하나)
3. 작업 후: `/devlog` 스킬로 개발 일지, `docs/memory/` 갱신
