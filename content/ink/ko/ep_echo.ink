-> echo_choose_01

=== echo_choose_01 ===
에코: 네 모습은 빈 책장을 닮았네.
에코: 무엇을 적을지는 네 몫이겠지.
에코: 그림책에 찻잔 자국이 남았어.
에코: 빌려 간 분께 뭘 전할까?
* [걱정했을 테니 괜찮다는 다정한 안부 쪽지를 끼워 전하자 # item:echo_01 # pick:a]
-> END
* [다음 독자를 위해 도서관 열람 수칙 안내문을 동봉하자 # item:echo_01 # pick:b]
-> END

=== echo_choose_02 ===
에코: 기록에는 축제 이야기도 있어.
에코: 기록철은 어디부터 찾아볼까?
* [늘 열람하던 단골 역사 서가에서 익숙한 표지를 찾아본다 # item:echo_02 # pick:a]
-> END
* [오늘 처음 자물쇠를 연 별관 다락 서고 문을 열어 본다 # item:echo_02 # pick:b]
-> END

=== echo_choose_03 ===
에코: 이건 이웃의 요리 수첩이야.
에코: 책장을 넘기니 계피 향이 나네.
에코: 이 수첩은 어디에 둘까?
* [도서관 분류 기준에 맞춰 요리 기술 서가 칸에 배치한다 # item:echo_03 # pick:a]
-> END
* [할머니의 따뜻한 사연이 전해지도록 입구 탁자에 소개한다 # item:echo_03 # pick:b]
-> END

=== echo_choose_04 ===
에코: 먼지가 좀 쌓였네. 에취!
에코: 책은 멀쩡해. 나도 괜찮고.
에코: 정리 방식은 어떻게 할까?
* [표지 색감과 주제를 새롭게 묶어 색다른 분위기로 꾸민다 # item:echo_04 # pick:a]
-> END
* [도서관에서 예전부터 써 오던 익숙한 서가 배치대로 둔다 # item:echo_04 # pick:b]
-> END

=== echo_choose_05 ===
에코: 이 책의 두 자매는 봄에 만났어.
에코: 네겐 어디가 마음에 남았어?
* [인물들이 서로를 그리워하며 건넨 말들이 가슴에 남았어 # item:echo_05 # pick:a]
-> END
* [흩어진 단서들의 앞뒤 인과가 맞아떨어지는 점이 좋았어 # item:echo_05 # pick:b]
-> END

=== echo_choose_06 ===
에코: 이 전설집의 끝은 비어 있어.
에코: 이 책은 어떻게 전하면 좋을까?
* [옛 책의 원형을 그대로 지키도록 유리함에 넣어 전시하자 # item:echo_06 # pick:a]
-> END
* [읽는 이들이 새 결말을 덧붙이는 열린 책으로 꾸미자 # item:echo_06 # pick:b]
-> END

=== echo_enclose ===
고른 쪽지를 그림책에 끼우자.
-> END

=== echo_book_pickup ===
그림책 꾸러미를 집자.
-> END

=== echo_book_delivery ===
그림책을 빌려 간 주민에게 전하자.
-> END

=== echo_search ===
정한 서가나 다락 입구를 살펴보자.
-> END

=== echo_record_pickup ===
찾은 기록철을 집자.
-> END

=== echo_record_delivery ===
기록철을 열람대에 전하자.
-> END

=== echo_notebook_pickup ===
요리 수첩을 집자.
-> END

=== echo_notebook_delivery ===
정한 자리에 요리 수첩을 놓자.
-> END

=== echo_organizer ===
책 정리인: 이 책들도 자리를 찾아볼까.
-> END

=== echo_arrange ===
책을 고른 뒤 같은 주제 표식의 자리에 놓자.
-> END

=== echo_reading ===
책 정리인: 정리하다가 오래된 이야기를 찾았어.
에코가 열람대에 와서 함께 책을 펼친다.
먼 마을에 간 동생의 편지가 적혀 있다.
‘보고 싶어. 봄이 오면 돌아갈게.’
언니는 날짜와 다리 수리 소식을 확인했다.
봄이 오자 둘은 그 다리에서 다시 만났다.
-> END

=== echo_bookmark ===
고른 감상이 담긴 대목에 책갈피를 놓자.
-> END

=== echo_return ===
에코에게 돌아가자.
-> END

=== echo_legend_pickup ===
전설집을 집자.
-> END

=== echo_legend_delivery ===
고른 전시대에 전설집을 놓자.
-> END

=== echo_report ===
에코에게 정리를 마쳤다고 알리자.
-> END

=== echo_completed ===
에코: 같이 돌봐 줘서 고마워.
에코: 축제에서 다시 보자.
-> END
