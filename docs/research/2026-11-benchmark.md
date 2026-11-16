# 벤치마크 리서치: 출시 가능한 모바일 웹 게임으로

2026-11-08 조사. 기준 코드는 `main` #90. 실행 순서는 [출시 계획](../roadmap/release-plan.md)에 있다.

복제하지 않고 원칙만 가져온다. 다른 게임의 이름, 캐릭터, 에셋, 외관은 쓰지 않는다. 측정 수치와 문항은 이 문서로 바꾸지 않는다.

## 1. 결론

전체 흐름은 E2E로 끝까지 통과한다. 출시를 막는 것은 끝 경험과 전달 경로다. 결과가 글자 패널이고, 유형에 이름이 없고, 공유가 글자 전송뿐이고, 초대권이 없다. 실제 폰에서 끝까지 해 본 기록도 없다. 결과와 공유를 먼저 만들고, 그다음 30분의 재미를 다듬는다.

가장 큰 위험은 길이다. 비교한 심리테스트 사례는 2분에 약 90%가 결과까지 갔다. Abraxas는 32분이다. 완주율을 재기 전에는 이 구조가 통한다고 말할 수 없다.

## 2. 지금 코드와 출시 사이의 간격

| 영역 | 확인한 사실 | 출시 영향 |
| --- | --- | --- |
| 결과 화면 | `client/src/ui/game.ts`의 `result()`가 문장을 이어 패널에 표시한다. 이미지 카드가 없다 | 게임의 보상이자 공유 원천이 약하다 |
| 근거 있는 결과 | 가치 TOP 3, '그렇게 본 순간', NPC 전후 변화가 #88로 들어왔다 | 있음. 시각 표현만 남았다 |
| 16유형 | 이름과 일러스트가 미정이다. 극 설명 문장만 있다 | 공유할 이름이 없다 |
| 공유 | `navigator.share({text})`뿐이다. 이미지, 링크, Kakao, OG 태그가 없다 | 카카오톡에서 링크가 밋밋하게 보인다 |
| 초대권 | `client/src`, `server`, `rules.json`에 ticket, invite가 없다 | 재플레이와 바이럴 구조가 미구현이다 |
| 소리 | 영상 음소거 외 월드 오디오가 없다 | 몰입 공백 |
| 계측 | 분석과 오류 수집 도구가 없다 | 이탈 지점을 알 수 없다 |
| 성능 | 실제 폰 FPS와 발열이 미측정이다. 11월 1일 수치는 에뮬레이션이다 | 가장 큰 미확인 위험 |
| 플레이타임 | 32분은 설계값이다. 사람이 잰 기록이 없다 | 페이싱 판단 근거가 없다 |
| 배포 | 운영 App Check, 저장, 배포를 하지 않았다 | 출시 전 필수 |

이번에 게임을 직접 끝까지 플레이하지는 않았다. 코드와 문서 기준 판단이며 M1이 검증한다.

## 3. 결과와 바이럴

| 벤치마크 | 확인한 것 | Abraxas 적용 |
| --- | --- | --- |
| [W컨셉×푸망 심리테스트](https://newneek.co/@goldenax/article/39568) | 11문항, 2분, 2주 177,390회. 시작 196,685명 중 176,680명이 결과에 도달. 유형별 캐릭터 16종. 네이티브 공유 9,793회, 카카오 859회, URL 복사 639회. 유형별 공유율 최고 17.28% | 네이티브 공유를 첫 버튼, 카카오를 둘째로 둔다. 유형 캐릭터를 공유 단위로 삼는다. 유형별 공유율을 재서 약한 카드를 고친다 |
| [Wordle](https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/) | 공유 격자 도입 뒤 확산했다. 로그인 없이 복사하고, 어디서나 보이고, 답을 밝히지 않는다 | 카드에 이야기와 선택을 넣지 않는다. 정책의 '판정 근거 공유 제외'와 맞는다 |
| [Spotify Wrapped](https://nogood.io/blog/spotify-wrapped-marketing-strategy/) | 탭으로 넘기는 세로 카드, 플랫폼 규격의 크기, 숫자 대신 펀치라인, 마지막에 공유 | 게임은 가로지만 공유 이미지는 세로 9:16으로 만든다. 알이 깨진 뒤 한 장씩 공개한다 |
| [16Personalities 계열 비평](https://www.sdfi.co.kr/news/an-accuracy-review-of-the-16-personalities-test.html), [측정 비평](https://casrai.org/psychology-research/mbti) | 연속 점수를 이분법으로 나누면 재검사에서 뒤집히기 쉽다. 설명문은 Barnum 효과 비판을 받는다 | 경계 축을 '양쪽 다 있는 사람'으로 표현한다. '그렇게 본 순간'을 유지한다 |
| [심리테스트 조건](https://www.openads.co.kr/content/contentDetail?contsId=5333) | 재미, 공감, 이야깃거리를 성공 조건으로 든다 | 친구 비교 링크. 받은 사람이 끝내면 두 사람의 닮은 점과 다른 점을 보여 준다 |

## 4. 짧은 서사와 재미

| 벤치마크 | 확인한 것 | Abraxas 적용 |
| --- | --- | --- |
| [Florence](https://gamedeveloper.com/audio/designing-i-florence-i-to-convey-the-ineffable-feeling-of-being-in-love) | 일상 동작을 관계의 은유로 쓴다. 대사 넘기기와 약하게 이어진 미니게임을 피했다. 후보 레벨의 절반 이상을 버렸다. 인물마다 고유 악기가 있다 | 심부름과 퍼즐을 '이 동작이 이 사람을 보여 주는가'로 감사하고 못 넘으면 지운다. 인물별 악기 모티프 |
| [A Short Hike](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/) | 작은 열린 세계, 호기심 보상, 길에서 벗어난 곳의 미니게임, 위치 따라 악기가 페이드 | `examine` 대상을 호기심 보상으로 재배치한다(측정 없음). 구역별 음악 층 |
| [Messenger (Abeto, 2025)](https://en.wikipedia.org/wiki/Messenger_(video_game)) | 무료 브라우저 게임이고 폰에서 돈다. 아주 작은 행성에서 배달 심부름을 한다. 리뷰가 유머와 살아 있는 세계를 칭찬한다 | 가장 가까운 비교 대상이다. 비평 페르소나의 기준선으로 삼는다. 우체부의 엉뚱한 유머를 다른 심부름 대사로 넓힌다 |
| [Alba](https://filmstories.co.uk/?p=83195) | 섬 크기보다 밀도를 관건으로 봤다. 재촉이 없다 | 정책의 '군집과 여백'과 맞는다. 소품 개수 대신 구역 밀도를 검수한다 |
| [Monster Prom](https://twinfinite.net/reviews/monster-prom-review/) | 짧은 판 약 30분. 다양한 엔딩과 수집 현황이 재플레이를 만든다. 엔딩 보상이 약하면 동기가 꺼진다는 비평도 있다 | 재플레이 이유를 초대권 말고 '다른 사람에게 고백한 결말'과 '처음의 나와 비교'로 설계한다 |
| [Stardew Valley 하트 이벤트 작성법](https://stardewmodding.wiki.gg/wiki/Tips_for_Heart_Events_-_Writing_and_Narrative_Design) | 한 이벤트에 한 박자, 수 분 이내, 취미 너머의 목표와 고민을 보여 준다 | 에피소드 40줄 안에서 인물별 '역할 너머의 한 장면'을 넣는다 |
| [Sky](https://80.lv/articles/how-to-design-emotional-game-environments-for-sky-children-of-the-light/) | 환경이 말 없이 감정을 안내한다. 시간대가 흐름을 만든다 | 챕터별 빛 변화(정책 P4)를 저장된 챕터 상태에 묶는다 |
| [Finch](https://appbot.co/blog/finch-app-reviews-emotional-attachment-user-retention-product-loyalty/) | 리뷰에서 동반자 애착이 재방문 이유로 나온다. 인과는 입증되지 않았다. [알림이 죄책감을 준다는 후기](https://geneticslab.medicine.iu.edu/blogs/md-student-news/wellness-corner-a-digital-pet-is-your-self-care-best-friend)도 있다 | 데미를 공유 카드의 얼굴로 쓴다. 알림과 압박은 쓰지 않는다 |

## 5. 성격 측정을 게임에 넣기

| 벤치마크 | 확인한 것 | Abraxas 적용 |
| --- | --- | --- |
| [Silent Hill: Shattered Memories](https://bloody-disgusting.com/news/3230806/climax-reveals-the-myriad-ways-shattered-memories-messed-with-us/) | 행동으로 숨은 값 7개를 쌓아 세계를 바꾼다 | 체류와 탐색을 점수에 넣지 않는 정책을 유지한다. 행동은 세계의 반응으로만 쓴다 |
| [Pokémon Mystery Dungeon](https://bulbapedia.bulbagarden.net/wiki/Personality_Quiz_(Mystery_Dungeon)) | 초반 질문으로 숨은 성격을 쌓는다. 시리즈에 따라 질문자를 이야기에 넣기도 한다 | 측정 이유를 기억 찾기 이야기로 설명하는 지금 구조를 유지한다 |
| [Life is Strange](https://medium.com/game-design-fundamentals/critical-play-life-is-strange-e95ae6883ed2) | 에피소드 끝 선택 통계가 궁금증을 만든다 | 결과 뒤 '다른 플레이어는' 통계를 장면 말로 보여 준다. 측정 오염을 막으려 1회차 결과 뒤에만 |
| [Stealth assessment (Shute 등)](https://myweb.fsu.edu/vshute/pdf/psychometrics.pdf) | Evidence-centered design으로 측정 주장을 근거에 잇고 외부 척도와 상관을 본다 | 7절의 검증 절차 |

## 6. 기술과 배포

| 대상 | 확인한 것 | Abraxas 적용 |
| --- | --- | --- |
| [Instant Games 지침](https://developers.facebook.com/docs/games/build/instant-games/game-performance) | 초기 약 5초, 첫 진입 약 6MB 이내를 권한다 | 게임 10MB 상한과 별도로 '첫 탭까지' 예산을 둔다. 영상 지연 로딩 유지 |
| [Three.js 모바일 자료](https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/) | 인스턴싱과 배칭, 드로콜 100 이하 지향(블로그 수치), 기기 등급별 품질 | 어귀 근처 한 장면은 calls 119, 그림자 pass가 그중 37%다([기준선](../reviews/m0-trial/perf-baseline.md)). 인스턴싱을 정답으로 두지 않고 실제 폰으로 병목을 먼저 잰다 |
| [카카오 공유](https://developers.kakao.com/docs/ko/kakaotalk-share/common) | SDK 전용이다. 공유 웹훅으로 서버가 발송 성공을 받을 수 있다. 쿼터가 있다 | 초대권 서버 판정과 맞는다. `navigator.share`는 전송을 증명하지 못해 지급 기준을 사람이 정해야 한다 |
| [카카오 인앱 브라우저](https://devtalk.kakao.com/t/branch/151358) | `kakaotalk://web/openExternal` 사례가 있으나 비공식이다. WebGL과 자동재생 공식 자료는 못 찾았다 | 실기기로 측정한다. 필요하면 외부 브라우저로 안내한다 |
| [Google H5 Games Ads 정책](https://support.google.com/publisherpolicies/answer/11975916), [베타](https://developers.google.com/ad-placement/docs/beta?hl=zh-tw) | 비공개 베타이고 승인이 필요하다. 전면 광고는 자연스러운 전환 지점만. 보상형은 선택제이고 금전성 보상 불가 | 광고는 에피소드 사이와 결과 뒤만. 측정 선택과 반응 사이 금지. 승인 전 코드를 넣지 않는다 |
| [등급분류 안내](https://toss.im/apps-in-toss/blog/game_rating_classification), [비영리 면제 보도](https://www.greened.kr/news/articleView.html?idxno=112837), [민간 이양](https://v.daum.net/v/20260527114715779) | 등급 없이 서비스할 수 없다고 안내한다. GRAC 직접 신청은 약 10~15일. 비영리 면제 근거가 있으나 광고 수익이 있으면 해당 여부가 불확실하다 | 사람이 GRAC, 법령 원문, 전문가로 확인한다. 일정의 선행 조건이다 |
| [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/) | 색만으로 정보 전달 금지, 자기 속도로 글 넘기기, 설정 저장 | 기존 UI 기준과 대조한다 |

## 7. 심리학 제안

표현 층 변경이다. 결과 설계는 사람 승인 후 진행한다.

**실생활 쓸모.**

- 경계 축은 '양쪽 다 있는 사람'으로 말하고 숫자는 보여 주지 않는다.
- 유형별 '이번 주 작은 실험' 카드를 '만약 ~하면, ~해 본다' 형식으로 만든다. if-then 계획과 행동 활성화는 [PEACH 시험](https://zendy.io/title/10.1073/pnas.2017548118)([프로토콜](https://doaj.org/article/d82734a758b54d8498d5a32747317e12))의 구성 요소다. 이 시험은 n=1,523, 3개월 앱 개입이고 관찰자 평가 효과는 약하다. 그래서 '성격이 바뀐다'고 주장하지 않는다.
- '그 사람' 카드는 궁합 판정이 아니라 다른 사람을 이해하는 소재로 쓴다.
- 기존 고지에 진단, 채용, 연애 판단에 쓰지 말라는 안내를 더한다. 위기 상황 문구가 필요한지는 전문가에게 묻는다.

**측정 검증.**

- 축 대응은 추론이다. A는 외향성, C는 개방성에 가깝고, D는 [조절 초점](https://www.frontiersin.org/articles/10.3389/fpsyg.2017.02005/full), E는 시간 관점, B는 의사결정 양식에 가깝다. 심리학자 에이전트가 문헌으로 확인한다.
- 한쪽이 더 멋져 보이는 선택지를 찾는다. 문구 변경은 사람 승인 사항이다.
- 파일럿에서 동의한 참가자가 게임과 공개 Big Five 척도를 함께 하고, 일부는 재플레이로 재검사 안정성을 본다. 규모와 방법은 전문가 검토 후 정한다.

**한계.** 심리학자 subagent는 자격 있는 전문가가 아니다. 사실 확인과 초안까지만 맡는다. 데이터 없이 '검증됨'이라고 쓰지 않는다. 출시 전 실제 심리학자 자문 1회를 권한다.

## 8. 역할별 도구 근거

- [Subagent 문서](https://code.claude.com/docs/en/sub-agents): `.claude/agents/`, `skills` 미리 싣기, `isolation: worktree`.
- [blender-mcp](https://github.com/ahujasid/blender-mcp): 소켓에 인증이 없고 임의 Python을 실행한다. localhost, `BLENDER_MCP_SAFE_MODE=1`, `DISABLE_TELEMETRY=true`로만 쓴다.
- [three-agent-skills](https://github.com/emalorenzo/three-agent-skills): MIT, 100개 넘는 규칙, 커밋 4개뿐이라 설치 전 내용을 읽는다.
- [threejs-skills](https://github.com/CloudAI-X/threejs-skills): MIT, r186 기준. 프로젝트는 r187이라 타입 정의와 대조한다.
- [glTF Transform CLI](https://gltf-transform.dev/cli): `inspect`, `instance`, `join`, `palette`.
- [LLM 페르소나 플레이테스트](https://www.arxiv.org/abs/2510.01635), [난이도 측정](https://www.arxiv.org/abs/2410.02829): 초기 연구이고 사람 비교 표본이 작다. 막힘 발견에 쓰고 재미 판정은 사람에게 맡긴다.

## 9. 근거 한계

- 강함: Google 정책, Kakao 개발자 문서, Claude Code 문서, Game Accessibility Guidelines.
- 중간: 개발자 직접 글(PlayStation Blog, Game Developer), PEACH는 초록 수준 요약. W컨셉 사례는 2차 기사이고 광고 클릭률이 기사 안에서 8.6%와 6.4%로 어긋난다.
- 약함: Wordle, Wrapped, Finch, Three.js 수치. 블로그 위주라 방향만 참고하고 측정으로 대체한다.
- 찾지 못함: 16Personalities 결과 페이지 구조, Sky 온보딩, 카카오 인앱 WebGL 제약, 웹게임 등급분류 세부 절차, 카카오의 보상형 공유 규정. Messenger의 파일 크기와 플레이타임.
- 조사 중 한 GitBook 페이지(A Short Hike 분석)에 읽는 이에게 HTTP 요청을 시키는 삽입 문구가 있었다. 따르지 않았고 그 페이지를 출처로 쓰지 않았다.
