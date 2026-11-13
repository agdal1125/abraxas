# T021 지시문 대사 제거

담당: game-designer. 검수: Claude 메인. 근거: `docs/reviews/2026-11-08-design-inspection.md` 1절 5번, 3절.

## 사람 요청 원문

> 현재 게임 설계와 전반적인 디자인을 전부 검토하고, 어색한 부분 및 개선이 필요한 부분들에 대해서 Inspect를 해줘. 그리고 Solution도 방향성을 제안해줘.

점검 뒤 "승인이 필요 없는 선행 작업 5건을 지금 PR로 나눠 시작할까요?"에 사람이 "네, 시작"이라고 답했다.

## 지금 상태

네 에피소드의 ink에 "~하자."로 끝나는 지시문 knot이 56개 있다. 대상을 탭하면 대사창에 "모카에게 돌아가자" 같은 줄이 뜨는데, 같은 내용이 HUD 목표 칩에 이미 있다. 탭 수만 늘리고 인물은 말하지 않는다.

## 목표

지시문만 담은 knot의 본문을 비운다. knot 선언(`=== 이름 ===`)과 `-> END`는 남긴다. 본문이 비면 런타임이 대사창 없이 다음 단계로 넘어가므로 코드 수정이 없다. 검사 스크립트는 knot 존재와 순서를 보므로 knot을 지우면 안 된다.

## 비울 knot (ko·en 모두)

- `ep_moka`: `moka_pick_up`, `moka_deliver`, `moka_reservation_action`, `moka_share_action`, `moka_order_action`, `moka_return`, `moka_report`. `moka_arrange`는 "모카: 천천히 해도 돼."만 남기고 지시문 줄을 지운다.
- `ep_lumi`: `lumi_table`, `lumi_card`, `lumi_notice_pickup`, `lumi_notice_first`, `lumi_notice_second`, `lumi_notice_return`, `lumi_material_pickup`, `lumi_material_delivery`, `lumi_arrange`, `lumi_welcome`, `lumi_return`, `lumi_score_pickup`, `lumi_score_delivery`, `lumi_report`.
- `ep_echo`: `echo_enclose`, `echo_book_pickup`, `echo_book_delivery`, `echo_search`, `echo_record_pickup`, `echo_record_delivery`, `echo_notebook_pickup`, `echo_notebook_delivery`, `echo_arrange`, `echo_bookmark`, `echo_return`, `echo_legend_pickup`, `echo_legend_delivery`, `echo_report`.
- `ep_or`: `or_fire`, `or_bucket_pickup`, `or_find_sand`, `or_sand`, `or_sand_delivery`, `or_gears`, `or_weight`, `or_review`, `or_lantern_link`, `or_hook`, `or_return`, `or_finish`, `or_bell_delivery`, `or_report`, `or_report_a`, `or_report_b`.

## 남길 것

인물의 말과 선택의 결과를 보여 주는 줄은 모두 남긴다. `moka_delivered`, `moka_completed`, `lumi_stagekeeper`, `lumi_notice_first_a`, `lumi_notice_second_a`, `lumi_notice_first_b`, `lumi_notice_second_b`, `lumi_completed`, `echo_organizer`, `echo_reading`, `echo_completed`, `or_find_sand_a`, `or_find_sand_b`, `or_merchant`, `or_assistant`, `or_review_a`, `or_review_b`, `or_finish_a`, `or_finish_b`, `or_completed`, 그리고 모든 `*_choose_*` 문항 knot.

## 정보가 사라지는지 확인

비운 지시문이 HUD 목표 문구(`content/i18n/{ko,en}/{moka,lumi,echo,or}-errand.json`의 `objective`)에 없던 정보를 담고 있었으면, 그 `objective` 문구만 고쳐 보완한다. 다른 키는 건드리지 않는다. 모카 배달지가 ink에서는 "대장간 바깥 받침대", HUD에서는 "공방"으로 섞여 있다. 실제 월드 소품 이름(`content/world/village.json`, `content/i18n/ko/moka-errand.json`의 `moka-workshop-dropoff`)을 확인해 HUD 문구를 하나로 맞춘다. 어느 쪽이 맞는지 확신이 없으면 고치지 말고 질문으로 남긴다.

## 금지

문항 문구·순서·가중치 변경, 반응 문구(`content/i18n/*/dialogue.json`) 변경, knot 삭제나 이름 변경, 새 대사 추가, 코드 변경, `docs/memory/`·`docs/devlog/` 수정.

## 검사

- `npm --prefix client run ink`
- `node client/scripts/check-moka-ink.mjs`
- `node client/scripts/check-residents-ink.mjs`
- `node client/scripts/check-dialogue.mjs`
- `node client/scripts/check-visible-names.mjs`
- `npm --prefix client test` (ink 내용을 기대하는 테스트가 깨지면 이유를 적고 멈춘다. 테스트를 고치지 않는다)

E2E는 메인이 병합 전에 돌린다.

## 마무리

브랜치 `feat/remove-instruction-lines`에 커밋한다. push와 PR은 하지 않는다. 보고에 worktree 경로, 커밋 해시, 비운 knot 수(ko·en), 보완한 HUD 문구, 실행한 검사와 결과, 사람에게 물을 질문을 한국어로 적는다.
