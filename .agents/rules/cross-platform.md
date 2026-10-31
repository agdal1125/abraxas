---
trigger: model_decision
description: "스크립트, npm scripts, 빌드·테스트 설정, 파일 경로, 도구 설치 안내, CI를 만들거나 고칠 때 읽는다. 이 저장소는 macOS와 Windows를 오가며 작업한다."
---

# 멀티 플랫폼 규칙 (macOS · Windows)

사람은 macOS와 Windows를 오가며 작업한다. CI는 Linux다. 세 곳에서 같은 명령이 같은 결과를 내야 한다.

## 스크립트

- 저장소 작업 스크립트는 Node(`scripts/*.mjs`)로 쓴다. `.sh`, `.ps1`, `.bat`을 새로 만들지 않는다.
- npm scripts에 셸 전용 문법을 쓰지 않는다: `rm -rf`, `cp`, `&&` 뒤의 `export X=…`, `$VAR`, 작은따옴표 인자. 필요하면 Node 스크립트로 옮긴다.
- 경로는 코드에서 `path.join` / `filepath.Join`으로 만든다. 문자열로 `/`나 `\`를 붙이지 않는다.
- 외부 바이너리를 OS별로 따로 설치해야 하는 도구는 피한다. npm 패키지나 Go 모듈로 대체할 수 있으면 그쪽을 쓴다 (예: ink 컴파일은 inklecate 대신 `inkjs`의 내장 컴파일러).

## 파일

- 파일·폴더 이름은 소문자 kebab-case. macOS·Windows는 대소문자를 구분하지 않지만 Linux CI는 구분한다. 대소문자만 다른 이름 변경은 `git mv`로 두 단계에 나눠 한다.
- 줄바꿈은 LF (`.gitattributes`, `.editorconfig`). `.ps1`·`.cmd`만 CRLF.
- 심볼릭 링크를 저장소에 커밋하지 않는다. 필요하면 `npm run setup`이 로컬에서 만든다.
- 경로 길이: Windows 기본 260자 제한을 넘기지 않게 폴더를 깊게 만들지 않는다.

## 도구 버전

- Node: `.nvmrc`(22) + `package.json` `engines`. Go: `server/go.mod`의 `toolchain`. 버전이 다르면 `npm run doctor`가 알려준다.
- 문서의 설치 안내는 macOS(Homebrew)와 Windows(winget) 두 줄을 함께 쓴다.

## 환경 변수

- `.env.local`은 OS와 무관하게 Vite·Go가 직접 읽는다. 셸에서 `export`/`$env:`로 넣는 방식을 문서에 쓰지 않는다.
