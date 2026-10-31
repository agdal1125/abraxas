---
name: devlog
description: Writes the day's development log entry for Abraxas in docs/devlog and, when a Notion tool is available, adds the same entry to the Notion "개발 일지" database. Use at the end of a work session, after a decision, or when the user says 개발 일지, 일지 써줘, devlog.
---

# 개발 일지 작성

## 1. 내용 모으기

- 이번 세션의 git 변경(`git log --since=midnight --oneline`, `git diff --stat`).
- 사람이 확정한 결정, 막혔던 문제와 해결, 다음 할 일.
- 추측이나 채택되지 않은 제안은 넣지 않는다.

## 2. 파일 쓰기

`docs/devlog/YYYY-MM-DD.md` (한국 시간 기준 날짜). 세션 머리에 작업한 컴퓨터(`mac` / `windows`)를 적는다. 같은 날 파일이 있으면 아래에 `## 세션 N`으로 덧붙인다.

```markdown
# YYYY-MM-DD

## 세션 1 · <한 줄 요약>
- 유형: 결정 | 구현 | 아트 | 콘텐츠 | 버그 | 회고
- 시스템: 성향 | NPC | 퀘스트 | 결과 | 초대권 | 인프라 | 아트 | 에이전트 세팅

### 한 일
- …

### 결정
- … (→ docs/memory/decisions.md 반영 여부)

### 막힌 것 / 배운 것
- … (→ docs/memory/lessons.md 반영 여부)

### 다음
- [ ] …
```

## 3. 메모리 반영

- 결정은 `docs/memory/decisions.md`, 교훈은 `docs/memory/lessons.md`, 진행 상태는 `docs/memory/status.md`에 반영한다 (`.agents/rules/memory-protocol.md`).

## 4. 노션 반영 (도구가 있을 때만)

- 대상: 노션 워크스페이스 "ABRAXAS: The Shattered Shell" › 개발 › "개발 일지" 데이터베이스
  - 데이터베이스: https://app.notion.com/p/e3aba4d1c97a4d94b69b19c677c9c129
  - 데이터 소스: `collection://ec7b152c-4a81-4470-929f-776598262de6`
- 속성: `요약`(제목), `날짜`, `유형`(결정·구현·아트·콘텐츠·버그·회고), `시스템`(다중 선택), `상태`(진행 중·완료), `링크`(커밋/PR URL), `작성`(사람·Claude·Antigravity). 본문은 파일 내용과 같게.
- 노션 도구가 없으면 건너뛰고, 사용자에게 파일 경로만 알려준다.
