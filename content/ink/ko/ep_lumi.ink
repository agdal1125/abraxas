VAR local_story = false
~ local_story = true
-> lumi_choose_01

=== lumi_choose_01 ===
루미: 안녕! 나는 축제 준비를 맡은 루미야.
주인공: 안녕. 기억이 잘 안 나서, 여기가 어디인지도 모르겠어.
루미: 기억이 안 난다고? 낯설겠다. 괜찮으면 나랑 축제 준비부터 같이 해 볼래?
루미가 천막 안에 놓인 리본과 꽃을 가리킨다.
* [한쪽 탁자에서 내가 맡은 장식 리본을 조용히 묶을게 # item:lumi_01 # pick:a]
* [여럿이 모여 담소 나누며 꽃줄을 엮는 자리로 갈게 # item:lumi_01 # pick:b]
-
{ local_story: -> lumi_choose_02 }
-> END

=== lumi_choose_02 ===
루미가 무대에 올릴 공연 카드 두 장을 펼친다.
* [올해 처음 선보이는 색채 그림자극을 무대에 올리자 # item:lumi_02 # pick:a]
* [해마다 이맘때면 열던 전통 등불극을 올해도 이어 가자 # item:lumi_02 # pick:b]
-
{ local_story: -> lumi_choose_03 }
-> END

=== lumi_choose_03 ===
루미: 축제 시작 시각을 알려야겠어. 안내문과 나팔이 여기 있어.
* [장터 골목을 돌며 마주치는 주민들에게 직접 말을 건넨다 # item:lumi_03 # pick:a]
* [마을 게시판과 우편함을 돌며 안내문을 붙여 알린다 # item:lumi_03 # pick:b]
-
{ local_story: -> lumi_choose_04 }
-> END

=== lumi_choose_04 ===
무대 기둥을 꾸밀 꽃줄이 한 묶음 모자란다. 루미와 재료를 고르자.
* [회관 창고에서 작년에 썼던 익숙한 리본 장식을 가져온다 # item:lumi_04 # pick:a]
* [들판의 솔방울과 잎을 주워 색다른 장식을 새로 엮는다 # item:lumi_04 # pick:b]
-
{ local_story: -> lumi_choose_05 }
-> END

=== lumi_choose_05 ===
루미: 곧 손님들이 오겠네. 어떻게 맞이할까?
* [입구 안내판 옆에서 환영 엽서를 건네며 조용히 맞이할게 # item:lumi_05 # pick:a]
* [광장 한복판에서 밝은 목소리로 인사하며 손님을 모을게 # item:lumi_05 # pick:b]
-
{ local_story: -> lumi_choose_06 }
-> END

=== lumi_choose_06 ===
악사들이 축제를 열 행진곡 두 곡의 악보를 펼쳐 놓는다.
* [악사들이 오늘 처음 연주하는 경쾌한 신곡으로 시작하자 # item:lumi_06 # pick:a]
* [귀에 익어 편안한 마을의 옛 행진곡으로 시작하자 # item:lumi_06 # pick:b]
-
-> END

=== lumi_table ===
정한 자리에서 장식을 만들자.
-> END

=== lumi_card ===
고른 공연 카드를 무대 계획판에 놓자.
-> END

=== lumi_notice_pickup ===
정한 안내 도구를 집자.
-> END

=== lumi_notice_first ===
첫 번째 장소에 축제 소식을 전하자.
-> END

=== lumi_notice_second ===
두 번째 장소에도 축제 소식을 전하자.
-> END

=== lumi_notice_first_a ===
주민: 알려 줘서 고마워. 시작할 때 갈게.
-> END

=== lumi_notice_second_a ===
주민: 축제 소식이구나. 잘 들었어.
-> END

=== lumi_notice_first_b ===
게시판에 안내문을 붙였다.
-> END

=== lumi_notice_second_b ===
우편함에 안내문을 넣었다.
-> END

=== lumi_notice_return ===
안내 도구를 제자리에 돌려놓자.
-> END

=== lumi_stagekeeper ===
무대지기: 기둥 하나에 걸 꽃줄이 모자라. 재료를 더 구해 줄래?
-> END

=== lumi_material_pickup ===
정한 장식 재료를 집자.
-> END

=== lumi_material_delivery ===
재료를 무대 작업대에 전하자.
-> END

=== lumi_arrange ===
같은 모양의 고리와 표식을 이어 장식을 걸자.
-> END

=== lumi_welcome ===
정한 자리에서 손님을 맞이하자.
-> END

=== lumi_return ===
루미에게 돌아가자.
-> END

=== lumi_score_pickup ===
고른 행진곡 악보를 집자.
-> END

=== lumi_score_delivery ===
악보를 악사 받침대에 전하자.
-> END

=== lumi_report ===
루미에게 준비를 마쳤다고 알리자.
-> END

=== lumi_completed ===
루미: 함께해 줘서 고마워. 잠깐 쉬었다가 축제에서 또 만나자.
-> END
