# RS1-I 대사 인계

2026-11-02 · 구현 인계. agy `gemini-4-argon-medium`의 지속 429 및 111시간 할당량 초기화 제한으로 사용자 승인에 따라 `gpt-6.1-terra` xhigh 대체 작업. 커밋·배포와 공유 기억·개발 일지는 감독 담당이다.

## UI 연결 계약

- `content/ink/{ko,en}/ep_{lumi,echo,or}.ink`: `locked`를 제외한 각 RS1-C phase는 `{주민}_{phase}` knot다. `choose_01`~`choose_06`만 각 문항의 a, b 선택지를 갖는다. 선택 확정 후 knot는 대사 없이 끝나며 서버의 공감·생각 반응을 표시한다. 행동 knot는 선택지가 없고 독립적으로 종료된다. 월드 진입·명령·재개는 스냅샷 phase와 확정 답으로 결정한다.
- 분기 행동 연출은 공통 phase knot 대신 다음 knot를 확정 답에 맞춰 호출한다: `lumi_notice_first_a/b`, `lumi_notice_second_a/b` (`lumi_03`); `or_find_sand_a/b` (`or_02`); `or_review_a/b` (`or_04`); `or_finish_a/b`, `or_report_a/b` (`or_06`). 루미의 두 소식 전달과 오르 낚시꾼·상인 대화는 각각 별도 명령이다. `or_report_b`는 광장에 합류한 오르를 가리키며 보고 대상은 계약대로 유지한다. 나머지 행동 knot는 명령 전 안내로, 분기 완료 문구는 해당 명령 성공 후에 표시한다. `echo_reading`은 `reading` 행동에서 선택 전에 한 번 표시한다.
- 루미의 기존 로컬 최초 진입은 ink 루트에서 `local_story`를 켜고 여섯 선택 knot를 순서대로 이어 간다. 서버 UI가 각 knot를 직접 열면 기본값이 꺼져 선택 직후 종료된다. 기존 `game.ts`의 `episodeStage`와 재개 시 `content.ts` 문항·번역 대체 경로를 유지한다. 에코·오르 로컬 체험도 기존 데이터 소비 경로를 유지한다. 로컬 기록을 서버 기록으로 옮기지 않는다.
- `content/i18n/{ko,en}/{주민}-errand.json`은 모카와 같은 `objective`, `items`, `reaction`, `puzzle`, `status` 구조다. `objective`는 퀘스트 `objectiveKeys`의 마지막 부분인 phase와 `pick_up_rest`를 키로 쓴다. `items`는 대상 ID, 운반 물건 ID, 받침대 ID, 빈손 `empty`, 퍼즐 `pieces`/`slots`의 모양 값을 키로 쓴다. 퍼즐 조각과 자리의 반복 구별은 UI가 위치·상태를 제공하며 이름은 같은 모양에 공유한다.
- `puzzle.select`, `selected`, `placed`, `empty`는 조각 선택·배치 상태의 접근성 문구이고 `hint`, `auto`, `close`, `wrong`은 작업판 공통 제어다. 오르 별도 도면은 `linkHint`, `linkAuto`로 안내하고 자동 연결도 `act`를 사용한다. 재시도·저장 문구는 `status`를 사용한다. `ui.json`의 승인된 주민·역할 이름은 이미 존재해 변경하지 않았다.
- 표시 문구에서 퀘스트 ID를 그대로 출력하지 않는다. 단계·대상·물건·조각의 유효성, 운반, 완료와 보상은 RS1-C 및 서버가 판단한다. 이 패키지는 UI나 서버를 수정하지 않는다.

## 검증과 남은 연결

`client/scripts/check-residents-ink.mjs`는 원본 문항·번역과 선택지 순서, 태그, 각 phase·분기 knot, 대상·모양 번역, 언어별 키, 금지 문구 및 ink 실행을 확인한다. 클라이언트 `npm run ink`, `npm run typecheck`, `npm test`(23개 파일·92개 테스트), 주민·모카 ink 검사와 `git diff --check`가 통과했다. 서버 `go vet ./...`와 `go test ./...`는 네트워크를 끄고 설치된 로컬 Go 1.27.0과 `.e2e` 캐시를 사용해 통과했다. 기본 지정 도구체인 1.27.3은 오프라인 검증이 불가능했으며 `govulncheck` 실행 파일은 없었다.

UI 담당은 각 행동 전후 표시 시점과 분기 knot, 퍼즐 접근성, 서버 확정 반응 및 광장 보고를 연결하고 실제 기기에서 확인해야 한다. 기존 로컬 체험의 데이터 경로는 보존했지만 브라우저 실행은 요청에 따라 수행하지 않았다.
