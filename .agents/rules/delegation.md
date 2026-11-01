---
trigger: model_decision
description: "작업을 다른 에이전트(Codex CLI, Antigravity CLI)에 맡기거나, 병렬 세션·PR·병합을 다룰 때 읽는다."
---

# 작업 위임과 병렬 진행

ADR-0004의 작업 단위를 유지하되, 역할·대체 모델은 T013 사람 요청(2026-11-01)과 사람의 이전 지시를 우선한다. Claude(Opus)가 지휘·검수·병합·최종 판단을 맡고, 계획·디자인과 실제 구현은 아래 CLI 에이전트에 맡긴다. 감독은 검수 후 ADR-0004와 공유 결정 기록도 같은 기준으로 갱신한다.

## 누가 무엇을

| 작업 | 담당 | 모델 |
| --- | --- | --- |
| 전반적인 게임 개발 계획·게임/화면/조작 디자인 | Codex CLI `codex exec` | `gpt-6-astra`, reasoning effort `high` |
| 실제 개발·코딩 (클라이언트·서버·스크립트·테스트) | Antigravity CLI `agy -p` | `gemini-4-argon-medium` |
| 디자인·그래픽·아트 애셋 생성 | Antigravity CLI `agy -p` | `gemini-4-argon-medium` |
| agy 사용량 한도에 걸린 구현·아트 작업의 대체 | Codex CLI `codex exec` | `gpt-6.1-terra`, effort는 난이도로 정함 |
| 지휘·작업 지시서·검수·PR 병합·최종 판단 | Claude (Opus) | — |
| 비밀값·배포·결제, 측정 수치 변경 승인 | 사람 | — |

디자인 방향과 사양을 정하는 일은 Astra, 그 사양의 코드 구현과 실제 애셋 제작은 agy가 맡는다. 계획 담당자는 별도 구현 지시가 없으면 제품 코드를 수정하지 않는다. 사람의 확정 지시는 오래된 역할 표보다 우선한다.

## Codex (계획·디자인, agy 한도 시 대체)

- 계획·디자인은 `gpt-6-astra`와 reasoning effort `high`를 사용한다.
- agy 한도 대체 구현의 effort: 단순 수정·문서 `low`, 일반 기능 `medium`, 계산 규칙·보안·동시성 `high`. `xhigh` 이상은 Claude가 이유를 적을 때만.
- 호출 형식(작업 폴더는 그 작업의 worktree):

  ```text
  codex exec -m gpt-6-astra -c model_reasoning_effort="high" -s workspace-write -C <worktree> "<계획·디자인 지시. 제품 코드 수정 금지>"
  ```

- agy 사용량 한도에 따른 대체 호출 예시:

  ```text
  codex exec -m gpt-6.1-terra -c model_reasoning_effort="medium" -s workspace-write -C <worktree> "<동일한 구현 지시와 쓰기 범위. agy 한도에 따른 대체임을 결과에 기재>"
  ```

- ponytail 플러그인(`ponytail@ponytail`)이 켜져 있어야 한다(`codex plugin list`). 과설계를 막는 용도다. 지시문에도 ‘가장 단순한 구현, 요청 범위 밖 추상화 금지’를 넣는다.
- 테스트는 핵심 동작만: 계산 규칙, 신뢰 경계(인증·입력 검증), 회귀가 실제로 난 곳. 게터·설정값·프레임워크 동작을 확인하는 테스트는 쓰지 않는다.
- 긴 지시와 이미지 입력은 UTF-8 프롬프트 파일을 표준 입력으로 전달하고 입력 스트림을 닫는다. 셸별 리다이렉션을 저장소 공용 스크립트에 하드코딩하지 않는다(`docs/memory/lessons.md`, `cross-platform.md`).
- 한국어 문서는 `apply_patch`로 UTF-8 저장하고 새·변경 파일의 연속 물음표 깨짐 검색 결과를 보고한다. PowerShell 기본 인코딩의 `Set-Content`·`Out-File`로 한국어를 쓰지 않는다.
- Codex 샌드박스가 `.agents/` 쓰기를 막으면 전체 대체본을 `docs/tasks/`에 작성하고 Claude가 검수 후 원본에 복사한다. 권한 우회를 시도하지 않는다.

## agy (실제 개발·디자인/아트 애셋 생성)

- 기본 `--model gemini-4-argon-medium`. 호출은 `agy -p` headless로 작업별 worktree에서 실행하고 목표·독점 쓰기 파일·완료 기준·필수 검사·커밋 금지를 함께 전달한다.
- 사용량 한도 오류가 나면 사람의 이전 지시 **‘agy 한도에 걸렸으면 그냥 Codex 를 하나 더 사용해’**에 따라 같은 작업을 Codex `gpt-6.1-terra`로 대체한다. 결과 보고에 한도 오류, 실제 사용 모델·effort, 이어받은 범위와 미완료 항목을 적는다. 같은 파일을 두 작업자가 동시에 쓰지 않도록 기존 세션 상태부터 확인한다.
- 새 작업을 시작할 때마다 Argon4를 먼저 시도한다. 한도가 풀렸으면 원래 담당 모델로 돌아간다. 권한 오류나 테스트 실패를 사용량 한도라고 보고하지 않는다.
- 대체 모델에서 필요한 제작 도구를 사용할 수 없으면 완료로 포장하지 말고 해당 애셋과 도구 제약을 Claude에게 보고한다. 사용 가능한 범위의 작업은 계속한다.
- headless 권한: 명령은 **정확한 문자열**, 파일 쓰기는 **디렉터리 단위**로 `--settings` JSON에 허용한다(`docs/memory/lessons.md`). 이 계정에서 `--mode auto`는 사용할 수 없다.
- `command(go)`·`command(go *)`처럼 넓은 허용은 정확한 명령 허용을 대신하지 못한다. `command(go -C server test ./...)`처럼 실행할 각 문자열을 별도로 나열하고 지시문에도 허용 목록을 적는다. 셸 연산자 체인은 별도 안전 검사로 차단될 수 있으므로 검사 명령을 각각 호출한다.
- 파일 쓰기는 `write_file(C:/절대/경로/작업디렉터리)`처럼 슬래시를 사용한 절대 디렉터리 접두로 허용한다. 다른 worktree·비밀값·감독 전용 파일을 넓게 허용하지 않는다.
- Windows Blender headless는 `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P <고정 스크립트>`의 실제 실행 문자열을 `&` 사용 여부에 맞춰 허용한다. 쓰기는 해당 소스·산출 디렉터리만 허용한다. 모델 호출과 도구 권한은 별도로 검증한다.
- 코드·애셋 모두 오류 처리·입력 검증·접근성·실기기 검증을 생략하지 않는다. 새 외부 의존성은 기존 정책에 따라 이유를 PR 설명에 적는다. 측정 수치는 사람 승인 없이 바꾸지 않는다.

## 병렬 세션과 PR

- 작업 하나 = 브랜치 하나 = worktree 하나 = PR 하나. 서로 다른 파일을 건드리는 작업만 동시에 돌린다.
- worktree 위치: `.claude/worktrees/<브랜치 이름>` (git 제외).
- 큰 변경은 구현 전에 계획을 보여주고 확인받는다. Astra가 변경 파일·연결 계약·검증 기준을 정리하고 Claude가 계획 승인과 구현 착수를 관리한다.
- 커밋·push·PR은 Claude가 검수 후 한다. 위임받은 에이전트는 커밋하지 않는다.
- `docs/memory/status.md`·`docs/devlog/`는 여러 PR이 함께 고쳐 충돌이 잦다. 위임 에이전트는 이 파일을 고치지 않고, Claude가 병합 직후 한 번에 갱신한다. 확정 결정·교훈도 작업 보고로 인계해 공유 기록에 반영한다.
- 결과 보고에는 산출물 경로, 실제 사용 모델과 한도 대체 여부, 실행한 검사·실패 이유, 미측정 항목, 사람이 결정해야 할 질문을 적는다. 과거 다른 환경의 측정을 이번 작업 결과처럼 쓰지 않는다.

## 병합

- Claude가 CI 통과와 검수 보고서(`docs/reviews/`)를 확인하고 직접 병합한다(사람이 위임함, 2026-10-31).
- 그래도 사람 승인이 필요한 것: `game-design-policy.md` 수치 변경, 비밀값·배포·Firestore 규칙, 새 외부 서비스 연결.
- 필수 확인: 클라이언트 `npm run typecheck`, `npm test`; 서버 `go vet ./...`, `go test ./...`, `govulncheck ./...`. 실행할 수 없었던 검사를 통과로 표시하지 않는다. 렌더·입력 변경은 배포 빌드와 대상 기기의 증거까지 확인한다.
