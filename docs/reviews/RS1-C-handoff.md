# RS1-C 인계

2026-11-02 · agy 사용량 한도에 따른 Terra 대체 구현. 승인된 계획의 주민별 순수 전이와 콘텐츠 계약을 작성했다. 상세 타입·함수·단계·대상·조각·자리 ID와 fixture 형식은 [RS1-C 계약](../design/residents-errands-api.md)과 세 퀘스트 JSON을 기준으로 한다. 공통 타입은 `client/src/core/play.ts`, 주민별 함수는 `lumiView/transitionLumi/initialLumi`, `echoView/transitionEcho/initialEcho`, `orView/transitionOr/initialOr`다.

18문항의 ID·종류·a/b 뜻과 순서는 원본 `content/scoring/items.json` 및 승인 계획과 대조했다. 측정 데이터와 기존 모카 fixture는 변경하지 않았다. 수동·자동 퍼즐, 받침대 복구, 선택 분기, 잘못된 명령과 완료 전 마지막 행동, 중복 완료 및 네 주민의 24가지 순수 전이 완료 순서를 검사했다. 네 주민 사이의 `hub` 전환은 테스트에서 직접 설정했으므로 서버의 실제 구간 전환 검증은 아니다.

클라이언트 `npm run typecheck`와 `npm test`는 통과했다(23개 파일, 92개 테스트). 서버 `go vet ./...`와 `go test ./...`도 로컬 캐시와 네트워크 비활성화 설정에서 통과했다. `govulncheck`는 실행 파일이 없어 실행하지 못했다. 의존성은 부모 작업 공간에 설치된 `client/node_modules`를 이 worktree에 복사해 사용했다.

RS1-S는 JSON과 fixture를 소비해 서버 상태 검증·보상과 중복 처리를 구현한다. RS1-N은 새 스냅샷과 `place_piece` 및 주민별 `episodeEnd`를 검증한다. RS1-W/U는 논리 대상·재개점의 실제 접근성, 장면·번역·퍼즐과 도면 자동 연결을 구현한다. RS1-V는 세 퀘스트를 콘텐츠 버전과 통합 검증에 포함한다. 현재 기존 통신 검증은 새 상태·명령을 아직 검증하거나 전송하지 않는다. 서버 저장, 실제 이동·접근성, 실기기, 아트와 퍼즐 소요 시간은 이 패키지에서 검증하지 않았다.
