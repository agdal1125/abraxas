# 주민 심부름 RS1-C 계약

2026-11-02 · 구현 참고 계약. 저장·인증·명령 중복·보상과 다음 구간은 서버의 책임이다. 측정 문항과 가중치의 원본은 `content/scoring/`이며 이 계약에 복사하지 않는다.

## 공통 형식

`client/src/core/play.ts`는 `Pick`, `Choice`, `Command`, `PlaySnapshot`, `PendingCommand`, `LocalSync`, `contentVersionMatches`를 제공한다. 기존 모카 `place { breadId, slotId }`는 그대로 두고 `place_piece { pieceId, slotId }`를 추가한다. `pickup`, `set_down`, `deliver`, `act`, `talk`, `complete`는 기존 `targetId`를 쓴다. `auto_arrange`는 현재 주민의 열린 주요 퍼즐에서 남은 자리만 채운다. `finish_segment`는 주민 전이에서 거부한다.

신규 회차 스냅샷에는 기존 `moka` 외에 `lumi`, `echo`, `or`가 모두 필요하다. 각 상태는 `phase`, `objects`, `placements`, `completedAt`만 갖는다. 초기 상태는 각각 `initialLumi()`, `initialEcho()`, `initialOr()`와 각 fixture의 `initial`을 따른다. 물건 위치는 `source`, `player`, 해당 주민의 `*-rest`, `delivered` 중 하나다. 출발점의 구체적 대상은 확정 답과 단계로 결정한다. 한 손에 든 물건은 하나이며 다른 주민 물건이나 모카 바구니를 들고 있으면 전이를 거부한다. 고정 받침대에서 내려놓은 물건은 다시 집어야 진행한다.

각 `transitionLumi`, `transitionEcho`, `transitionOr`는 스냅샷과 명령, 서버 완료 시각을 받아 새 스냅샷을 반환한다. 실패는 각각 `invalid_lumi_transition`, `invalid_echo_transition`, `invalid_or_transition`이며 입력을 바꾸지 않는다. 완료는 최종 행동과 여섯 답, 운반·퍼즐을 확인한 뒤 `completedEpisodes`에 주민을 한 번 추가한다. 이 함수는 정상 저장 스냅샷을 전제로 하며 영수증·revision·반응·고정 완료 사건·보상·다음 막간은 구현하지 않는다. 서버는 수신값과 상태를 독립적으로 검증해야 한다.

`lumiView`, `echoView`, `orView`는 `phase`, `objectiveKey`, `activeTargetIds`, `resumePointId`, `carriedObjectId`, `objects`, `placements`, 문항 순서의 확정 `choices`를 반환한다. 목표와 대상·재개점은 각 퀘스트 JSON의 `objectiveKeys`, `phases`, `resumePoints`에 정의한다. 답에 따른 대상은 배열의 a/b 순서이며 미확정이면 활성 대상이 없다. 받침대에 물건을 놓으면 `*.objective.pick_up_rest`와 해당 받침대만 활성화한다. 재개점은 논리 ID이며 안전한 좌표는 월드 패키지가 검증한다. 오르의 마지막 b 보고 재개점은 `or-plaza-stand`, 보고 대상은 계속 `D`다.

## 닫힌 ID와 흐름

전체 단계·대상·조각·자리 및 물건별 위치의 닫힌 목록은 [루미](../../content/quests/lumi-errand.json), [에코](../../content/quests/echo-errand.json), [오르](../../content/quests/or-errand.json)에 있다. 각 `phases`의 두 대상은 확정 답 a/b에 대응한다. 조각과 자리의 값이 같은 것만 배치할 수 있으며 같은 조각이나 자리를 두 번 쓸 수 없다. JSON의 `objects` 키가 운반 표시 ID다.

- 루미: `notice`, `material`, `score`; 받침대 `lumi-rest`, 보고 대상 `A`. 안내 도구를 집은 뒤 a는 두 주민에게 `talk`, b는 게시판과 우편함에 `act`한다. 도구 반납, 무대지기, 재료 전달, 여섯 고리, 환영, 복귀, 악보 전달을 거쳐 보고한다.
- 에코: `book`, `record`, `notebook`, `legend`; 받침대 `echo-rest`, 보고 대상 `C`. 동봉과 그림책 전달, 선택한 서가/다락 탐색과 기록철 운반, 수첩 배치, 책 정리인, 여섯 책, 함께 읽기와 책갈피, 복귀와 전설집 전시 뒤 보고한다.
- 오르: `bucket`, `bell`; 받침대 `or-rest`, 보고 대상 `D`. 지도 확인 또는 낚시꾼·상인과의 순서 있는 대화 뒤 모래를 채워 전달한다. 세 톱니 퍼즐 뒤 `or_03`을 고르고 추를 단다. 별도 등불 도면에서 `or_04`를 고른 뒤 검토와 `or-lantern-link` 동작을 한다. 걸이와 복귀 뒤 `or_06` a는 연장 정리, b는 종을 집어 광장 받침대에 전달한 다음 보고한다. 양동이의 빈 상태와 채운 상태는 단계로 구분한다.

힌트는 현재 퍼즐에서 유효한 한 조각을 알려 주고, 자동 배치는 남은 조각을 채운다. 등불 도면의 짧은 연결은 `act`로 확인한다. 힌트의 화면 동작과 짧은 연결의 자동 실행은 UI 담당이 같은 명령으로 연결한다. 행동·퍼즐 결과로 답이나 점수를 추론하지 않는다.

## fixture와 후속 연결

`content/quests/fixtures/{lumi,echo,or}-errand.json`은 초기 스냅샷, 서버 시각, 수동 a·자동 b 성공 명령, 앞선 성공 명령 개수 기준 거부 사례 및 저장 계층의 중복 시나리오 이름을 담는다. 두 성공 경로 모두 여섯 번째 답 이후 행동을 실행한다. 기존 모카 fixture는 변경하지 않았다. fixture 자체는 저장 원자성이나 실제 이동을 증명하지 않는다.

서버는 새 상태·명령의 엄격한 파싱, 각 완료 사건과 보상, 최초 답 확정, 동일 키 및 의미상 중복 처리, 네 주민의 다음 구간을 구현한다. 통신 패키지는 새 상태와 `place_piece` 검증 및 해당 주민의 `episodeEnd`를 추가한다. 현재 통신 검증은 모카 계약 그대로다. 월드와 UI는 대상·재개점을 실제 접근 가능 위치와 번역된 목표에 연결한다. 콘텐츠 버전 입력에 세 JSON을 추가하는 일은 통합 패키지의 범위다.
