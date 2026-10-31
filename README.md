# Abraxas (가제)

기억을 잃은 내가 30분 동안 마을 사람들과 지내며, 선택으로 '진짜 나'를 되찾는 모바일 웹 심리 테스트형 연애 어드벤처.

- 기획: [docs/gdd](docs/gdd/README.md)
- 기술 스택: [ADR-0001](docs/adr/0001-tech-stack.md) · 에이전트 도구: [ADR-0002](docs/adr/0002-agent-tooling.md) · 멀티 플랫폼: [ADR-0003](docs/adr/0003-cross-platform.md)
- 에이전트 지침: [AGENTS.md](AGENTS.md)

## 구조

```
client/    Phaser 4 + TypeScript + Vite
server/    Go API (Cloud Run)
content/   ink 대사, 성향 가중치 데이터
docs/      기획, ADR, 공유 메모리, 개발 일지, 아트 가이드
scripts/   저장소 작업 스크립트 (Node, macOS·Windows 공용)
.agents/   에이전트 규칙(rules)과 스킬(skills)
```

## 처음 세팅

macOS와 Windows 모두 지원한다. 1단계 도구 설치만 OS별로 다르고, 2단계부터는 같은 명령이다.

### 1. 도구 설치

**macOS** (터미널, [Homebrew](https://brew.sh) 필요)

```bash
brew install git node@22 go
curl -fsSL https://antigravity.google/cli/install.sh | bash   # Antigravity CLI (agy)
```

**Windows** (PowerShell)

```powershell
winget install Git.Git OpenJS.NodeJS.LTS GoLang.Go
irm https://antigravity.google/cli/install.ps1 | iex           # Antigravity CLI (agy)
```

설치 후 터미널(또는 PowerShell)을 새로 연다. 배포 단계에서 필요해지면 그때 Firebase CLI(`npm install -g firebase-tools`)와 [gcloud](https://cloud.google.com/sdk/docs/install)를 설치한다.

### 2. 저장소 받기 · 세팅 (두 OS 공통)

```bash
git clone https://github.com/agdal1125/abraxas
cd abraxas
npm run setup                    # Claude Code용 스킬 링크 + 도구 버전 점검
npx skills add phaserjs/phaser   # Phaser 공식 에이전트 스킬
agy                              # Antigravity 실행 (처음엔 작업 폴더 신뢰 승인)
```

`npm run doctor`로 언제든 도구 상태를 다시 확인할 수 있다. 다른 컴퓨터로 옮길 때도 같은 순서다.

Antigravity 권장 플러그인은 앱의 Customizations › Plugins 또는 `agy plugin install <이름>`으로 설치한다. 플러그인은 컴퓨터마다 따로 설치해야 한다. 목록은 ADR-0002.

### 휴대폰 실기 테스트

같은 와이파이에서 `npm run dev -- --host`로 띄운 주소를 휴대폰 브라우저로 연다. Mac이 없어도 아이폰 Safari로 테스트할 수 있다.

## 작업 흐름

1. 작업 전: `git pull`, `docs/memory/status.md` 확인
2. 구현 → 테스트 → PR (목적 하나당 PR 하나)
3. 작업 후: `/devlog` 스킬로 개발 일지, `docs/memory/` 갱신, `git push`

컴퓨터를 바꿔 작업할 때는 끝낸 쪽에서 반드시 push하고, 시작하는 쪽에서 pull한다. 공유 메모리(`docs/memory/`)도 git으로 같이 옮겨진다.
