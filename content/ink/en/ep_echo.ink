-> echo_choose_01

=== echo_choose_01 ===
Echo: You came to help? ...Thank you.
Echo: You look like an empty bookshelf.
Echo: There's a tea stain on this picture book.
Echo: What should we send along to the borrower?
* [A kind note # item:echo_01 # pick:a]
-> END
* [The borrowing rules # item:echo_01 # pick:b]
-> END

=== echo_choose_02 ===
Echo: The records have festival stories too.
Echo: Where should we look first for the chronicle?
* [The usual history shelves # item:echo_02 # pick:a]
-> END
* [The newly opened attic # item:echo_02 # pick:b]
-> END

=== echo_choose_03 ===
Echo: This is a neighbor's recipe notebook.
Echo: Turning the pages brings a scent of cinnamon.
Echo: Where should we place this notebook?
* [On the cookbook shelf # item:echo_03 # pick:a]
-> END
* [By the door, with its story # item:echo_03 # pick:b]
-> END

=== echo_choose_04 ===
Echo: A bit dusty here. Achoo!
Echo: The books are unharmed. I'm fine too.
Echo: How should we organize these books?
* [New groups by color and theme # item:echo_04 # pick:a]
-> END
* [The old arrangement # item:echo_04 # pick:b]
-> END

=== echo_choose_05 ===
Echo: The sisters in this story met in spring.
Echo: Which part stayed with you the most?
* [The words of longing # item:echo_05 # pick:a]
-> END
* [How the clues fit # item:echo_05 # pick:b]
-> END

=== echo_choose_06 ===
Echo: The end of this village legend is blank.
Echo: How should we share this story?
* [Keep it as is, under glass # item:echo_06 # pick:a]
-> END
* [Let readers add endings # item:echo_06 # pick:b]
-> END

=== echo_organizer ===
Book Keeper: You're helping Echo? I look after the shelves.
Book Keeper: Shall we find where these books belong?
-> END

=== echo_reading ===
Book Keeper: While sorting, I found an old story.
Echo joins you at the table and opens the volume.
A letter from a sister far away reads:
'I miss you. When spring comes, I'll return.'
The older sister checked dates and bridge repairs.
Come spring, they met once more upon that bridge.
-> END

=== echo_report ===
Echo: The shelves have found their places.
-> END

=== echo_completed ===
Echo: The shelves seem to breathe again. Thanks to you.
Echo: I'll record tonight too. Every bit of it.
-> END
