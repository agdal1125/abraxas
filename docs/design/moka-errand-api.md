# 모카 심부름 ER1 계약

2026-11-02 · ER1-C 인계. 이 문서는 API 구현이나 운영 연결 완료를 뜻하지 않는다. 측정값의 원본은 `content/scoring/`이며 이 계약에 가중치나 기대 답을 복사하지 않는다.

## 공통 타입과 콘텐츠

클라이언트 타입은 `client/src/core/moka-errand.ts`, 언어 없는 대상·문항·모양 데이터는 `content/quests/moka-errand.json`이다. `MokaState`는 `phase`, `basket`, `placements`, `completedAt`을 가진다. `placements`는 자리 ID에서 빵 ID로 향하는 부분 객체다. `completedAt`은 완료 전 `null`, 완료 후 서버가 정한 UTC RFC 3339 시각이다. `PlaySnapshot`은 `playId`, `contentVersion`, 정수 `revision`, `segment`, `completedEpisodes`, 순서가 있는 `answers`, `moka`를 가진다. `answers`에는 이전 구간의 답도 들어간다. 완료 후에만 `episodeEnd: { npcId: "moka", hearts: 0..5의 정수 }`를 포함한다. 진행 중 원점수·축·NPC 기대 답·호감도 수치는 응답에 넣지 않는다.

`Command`의 종류별 필드는 다음뿐이다. 다른 필드나 `null`은 허용하지 않는다.

| kind | 추가 필드 |
| --- | --- |
| `open_episode` | `npcId` |
| `choice` | `itemId`, `pick` (`a` 또는 `b`) |
| `pickup`, `set_down`, `deliver`, `act`, `talk`, `complete` | `targetId` |
| `place` | `breadId`, `slotId` |
| `auto_arrange`, `finish_segment` | 없음 |

서버는 클라이언트가 보낸 사용자 ID, 콘텐츠 버전, 답 목록, 다음 단계, 점수, 완료 여부, 배치 전체를 받지 않는다. `finish_segment`는 기존 비모카 구간 전환용이고 모카에서는 거부한다. 다른 구간의 선택도 이 `choice` 명령 경로를 사용한다.

`mokaView(snapshot): MokaView`는 서버에서 확인한 스냅샷으로 목표 키, 활성 대상, 재개 지점, 바구니·배치, 답에서 파생한 길과 진열 방식을 계산한다. `moka.objective.pick_up_rest`는 `deliver` 중 바구니가 `moka-rest`에 놓인 경우의 목표다. 답이 없는 분기 행동의 활성 대상은 빈 배열이다. 재개 지점 ID는 월드가 검증한 안전 지점에 연결할 논리 ID이며 좌표가 아니다. `Village.setMokaView(view: MokaView)`를 사용한다. `transitionMoka(snapshot, command, completedAt?)`는 정상 서버 상태에 대한 순수 전이 참고 구현이다. 실패 시 `invalid_moka_transition`을 던지고 입력을 변경하지 않는다. 저장, 인증, revision, 응답, 중복 처리와 보상은 이 함수 바깥의 서버 책임이다. 완료 시각은 서버만 제공한다. 서버는 클라이언트 코드를 신뢰하거나 실행할 필요 없이 같은 콘텐츠와 fixture를 검증한다.

필수 ID는 JSON에 정의한 값이다. 캐릭터 `B`, 예약 손님 `v1j2`, `moka-basket-source`, `moka-rest`, `moka-workshop-dropoff`, `moka-display`, `moka-ledger`, `moka-reservation-bread`, `moka-tired-neighbor`, `moka-tasting-plate`, `moka-dough-double`, `moka-dough-reserved`를 사용한다. 경유점은 `moka-route-shortcut`, `moka-route-gentle`, 공통 `moka-route-join`이다. `moka-display`는 월드 배치 ID이고 `prop-moka-display`는 아트 자산 이름이다. 오르의 대장간 바깥 받침대만 배달 대상이다. 접근 가능 좌표는 월드 담당이 검증한다.

여섯 문항은 `moka_01`부터 `moka_06`까지 순서대로 한 번씩이다. 빵과 자리는 JSON의 세 모양별 두 개다. 사용한 빵, 점유된 자리, 다른 모양, 알 수 없는 ID는 거부한다. 자동 정리는 남은 빈 자리를 같은 모양의 미사용 빵으로 채운다. 같은 모양 두 빵에 숨은 순서는 없다. 수동과 자동 완료 모두 `share`로 간다. 완료는 `report`에서 여섯 답·배달·유효한 여섯 배치와 앞선 행동 전이가 충족된 뒤에만 가능하다. `completed`의 재전송은 아래 중복 규칙으로 처리한다.

## 콘텐츠 버전

서버와 클라이언트 빌드는 동일한 SHA-256 콘텐츠 버전을 사용한다. 입력은 `content/scoring/items.json`, `npcs.json`, `rules.json`, `content/quests/moka-errand.json`, `content/i18n/ko/`와 `content/i18n/en/`의 모든 JSON, `content/ink/ko/`와 `content/ink/en/`의 모든 `.ink` 원본이다. 각 파일의 원본 바이트 SHA-256을 소문자 16진수로 구하고, 저장소 상대 경로의 구분자를 `/`로 정규화해 경로를 UTF-8 바이트 순서로 정렬한다. 각 행을 `경로`, NUL 바이트, 해당 파일 해시, LF 바이트로 이어 붙인 전체 바이트를 다시 SHA-256으로 해시한다. 버전은 `sha256:`와 그 소문자 16진수 해시를 이어 쓴다. 파일 자체의 줄바꿈·인코딩은 변환하지 않는다. 두 빌드가 같은 원본 바이트를 사용해야 한다. 모카 양 언어 ink와 문구 파일을 포함한 필수 콘텐츠가 빠지면 버전을 만들지 않고 빌드를 실패시킨다. fixture의 `fixture-version`은 테스트 전용이다.

서버가 새 회차에 버전을 고정한다. 클라이언트는 `contentVersionMatches(snapshot, buildVersion)`으로 비어 있지 않은 빌드 버전과 정확히 비교한 뒤 문항을 연다. 불일치 시 새 버전을 불러오도록 안내하고 진행을 보류한다. 서버가 해당 회차 버전을 지원하지 않으면 `content_version_unavailable`을 반환한다. 버전 생성·빌드 주입은 환경 통합 담당이 구현하며, 이 패키지는 비교 함수와 알고리즘 계약만 제공한다.

## HTTP

모든 요청은 Firebase ID 토큰을 `Authorization: Bearer <token>`에, App Check 토큰을 `X-Firebase-AppCheck`에 담는다. 서버가 검증한 토큰의 uid만 소유권에 사용한다. 변경 요청은 클라이언트 UUID인 `Idempotency-Key` 헤더가 필요하다. 생성 키 범위는 uid, 명령 키 범위는 uid와 playId다. 요청 본문은 최대 64KB의 단일 JSON 객체이며 중복 키, 알 수 없는 필드, 뒤따르는 값, 빠진 필드, 음수·소수 revision, 잘못된 UUID와 잘못된 ID를 거부한다.

| 요청 | 본문 | 성공 |
| --- | --- | --- |
| `POST /v1/plays` | `{}` | `201` 새 회차 또는 `200` 기존 활성 회차의 스냅샷 |
| `GET /v1/plays/current` | 없음 | `200` 현재 회차의 스냅샷 |
| `GET /v1/plays/{playId}` | 없음 | `200` 소유 회차의 스냅샷 |
| `POST /v1/plays/{playId}/commands` | `{ "expectedRevision": 7, "command": { "kind": "choice", "itemId": "moka_01", "pick": "a" } }` | `200` 영수증과 최신 스냅샷 |

명령 응답 형식은 `{ "receipt": { "key": "<UUID>", "appliedRevision": 8, "reaction": "empathy" }, "snapshot": { ... } }`다. NPC 측정 선택의 `reaction`은 `empathy` 또는 `thinking`, 그 외 명령은 `null`이다. GET과 회차 생성은 영수증 없이 스냅샷 객체를 직접 반환한다. 회차 생성은 uid별 최초 서버 회차만 무료이며 이후 재플레이 권한이 없으면 거부한다. 기존 로컬 기록은 별도 보존하며 서버의 공식 답으로 가져오지 않는다.

오류 본문은 `{ "error": "<code>" }`다. 타인의 playId와 존재하지 않는 playId는 같은 응답이다.

| HTTP | 코드 | 의미 |
| --- | --- | --- |
| 400 | `invalid_request` | JSON, 필드, ID, UUID 또는 revision 형식 오류 |
| 401 | `unauthenticated` | 인증 누락·만료·실패 |
| 403 | `app_check_failed` | App Check 검증 실패 |
| 404 | `play_not_found` | 회차 없음 또는 소유자가 아님 |
| 409 | `revision_conflict` | 새 동작의 revision 불일치 |
| 409 | `idempotency_conflict` | 같은 키에 다른 경로·본문·기대 revision |
| 409 | `choice_locked` | 이미 확정된 문항에 다른 답 |
| 409 | `content_version_unavailable` | 서버가 해당 회차의 버전을 지원하지 않음 |
| 409 | `replay_not_ready` | 새 회차 개설 권한 없음 |
| 422 | `invalid_transition` | 현재 단계에서 허용되지 않는 문항·행동·대상·배치 |
| 413 | `request_too_large` | 본문 크기 초과 |
| 429 | `rate_limited` | 요청 제한 |
| 503 | `storage_unavailable` | 일시적 저장 실패 또는 결과 미확인 |

서버는 소유권·버전을 확인한 뒤 같은 키와 동일 요청이면 기존 영수증을 반환하고, 같은 키의 다른 요청은 충돌로 처리한다. 새 키라면 같은 문항의 같은 답과 이미 완료된 모카의 재완료를 revision 검사보다 먼저 변화 없는 성공으로 처리한다. 같은 문항의 다른 답은 `choice_locked`다. 그 밖의 새 동작은 revision을 검사한다. 의미상 중복은 새 영수증·반응·revision·보상을 만들지 않는다. 기존 영수증 재전송의 스냅샷은 더 최신일 수 있으며 클라이언트는 낮은 revision으로 되돌아가지 않는다. 그 외 성공은 상태·영수증을 원자적으로 저장하고 revision을 증가시킨다. 마지막 완료의 고정 사건 `moka-errand-completed`, 완료 목록과 보상도 같은 트랜잭션에서 한 번 기록한다.

클라이언트는 전송 전에 `{ key, expectedRevision, command }`를 로컬 대기 기록에 남긴다. 실패하거나 응답을 잃으면 같은 키와 본문을 다시 보낸다. `409`에서 재조회하고 최초 확정 답을 유지한다. 서버에 닿지 않은 대기 기록을 사용자가 지운 경우와 익명 인증을 잃은 경우는 복구를 보장하지 않는다.

## 공유 검증 자료

`content/quests/fixtures/moka-errand.json`은 Go와 TypeScript에서 읽는 순수 JSON이다. `initial`에서 시작해 `success[].commands`를 순서대로 적용하고 `expected`를 확인한다. `rejections[].after`는 첫 번째 성공 시나리오의 앞에서 적용할 명령 개수다. 그 다음 `command`는 상태를 바꾸지 않고 거부해야 한다. `completedAt`은 고정된 테스트 시각이다. `transportCases`는 서버 저장 테스트에 필요한 의미상 시나리오 목록이며 이 파일만으로 트랜잭션·인증·동시성 검증이 통과한 것은 아니다. 서버 담당은 각 항목을 실제 요청·영수증·revision·보상 검사로 구현한다.
