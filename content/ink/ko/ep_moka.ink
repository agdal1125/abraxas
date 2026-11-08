-> END

=== moka_meet ===
모카: 갓 구운 호두빵이야. 언덕 위 공방에 전해 줄래?
모카: 바구니 밑도 살펴뒀어. 어느 길로 갈래?
* [빵이 가장 따뜻할 때 전하려고 가파른 지름길로 달려간다 # item:moka_01 # pick:a]
-> END
* [빵이 눌려 상하지 않도록 완만한 길로 안전하게 걸어간다 # item:moka_01 # pick:b]
-> END

=== moka_pick_up ===
-> END

=== moka_deliver ===
-> END

=== moka_delivered ===
시식 안내인: 빵집에서 왔구나. 기다리고 있었어.
시식 안내인: 고마워! 출출했는데 좋은 때에 왔네.
-> END

=== moka_reservation ===
단골 손님이 어제 예약한 빵이라며 찾아왔다.
하지만 예약 장부에는 다른 빵 이름이 적혀 있다.
모카: 어쩌면 좋을까?
* [장부에 적힌 예약 내역을 함께 보며 사실부터 확인한다 # item:moka_02 # pick:a]
-> END
* [손님이 민망하지 않게 먼저 안심시키며 원하는 빵을 준다 # item:moka_02 # pick:b]
-> END

=== moka_reservation_action ===
-> END

=== moka_choose_display ===
모카: 진열대도 준비해 줄래? 어떻게 놓을까?
* [빵이 떨어져 상하지 않게 안정적인 1단 진열을 택한다 # item:moka_03 # pick:a]
-> END
* [가게 밖에서도 한눈에 띄는 높은 3단 진열을 노린다 # item:moka_03 # pick:b]
-> END

=== moka_arrange ===
모카: 천천히 해도 돼.
-> END

=== moka_share ===
모카: 진열이 끝났네. 고마워.
모카: 남은 빵은 어떻게 나눌까?
* [아까부터 지친 기색으로 서성이던 이웃에게 먼저 건넨다 # item:moka_04 # pick:a]
-> END
* [누구에게나 공평하게 같은 크기로 잘라 접시에 담아 둔다 # item:moka_04 # pick:b]
-> END

=== moka_share_action ===
-> END

=== moka_order ===
모카: 저녁 파이도 구워야 해. 얼마나 구우면 좋을까?
* [손님이 몰릴 기회를 살려 평소보다 두 배 많이 굽자 # item:moka_05 # pick:a]
-> END
* [남아 버리는 손실이 없게 예약된 수량만큼만 구워 내자 # item:moka_05 # pick:b]
-> END

=== moka_order_action ===
-> END

=== moka_return ===
-> END

=== moka_feedback ===
모카: 쿠키가 꽃처럼 피었는데 살짝 기울었네.
모카: 너한텐 어때 보여?
* [오븐 열기가 쏠린 듯하다며 기울어진 원인을 짚어 준다 # item:moka_06 # pick:a]
-> END
* [정성껏 구운 마음이 예쁘다며 고소한 향기부터 칭찬한다 # item:moka_06 # pick:b]
-> END

=== moka_report ===
-> END

=== moka_completed ===
모카: 함께해 줘서 고마워.
모카: 빵집이 한결 따뜻해졌어.
-> END
