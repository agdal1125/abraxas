-> echo_choose_01

=== echo_choose_01 ===
The library's return box is close to overflowing.
Echo: You came to help? ...Thank you. I was short on hands.
Echo: You look like an empty bookshelf.
Echo: What you write there will be up to you.
Echo: There's a tea stain on this picture book.
Echo: What should we send along to the borrower?
* [Reassure them that it is all right # item:echo_01 # pick:a]
-> END
* [Include the library’s borrowing rules # item:echo_01 # pick:b]
-> END

=== echo_choose_02 ===
Echo: The records have festival stories too.
Echo: Where should we look first for the chronicle?
* [Search the familiar corner shelves # item:echo_02 # pick:a]
-> END
* [Open the annex you have never visited # item:echo_02 # pick:b]
-> END

=== echo_choose_03 ===
Echo: This is a neighbor's recipe notebook.
Echo: Turning the pages brings a scent of cinnamon.
Echo: Where should we place this notebook?
* [File it with cookbooks by category # item:echo_03 # pick:a]
-> END
* [Display it by the entrance with its story # item:echo_03 # pick:b]
-> END

=== echo_choose_04 ===
Echo: A bit dusty here. Achoo!
Echo: The books are unharmed. I'm fine too.
Echo: How should we organize these books?
* [Make new groups by color and theme # item:echo_04 # pick:a]
-> END
* [Keep the familiar library arrangement # item:echo_04 # pick:b]
-> END

=== echo_choose_05 ===
Echo: The sisters in this story met in spring.
Echo: Which part stayed with you the most?
* [Remember the words the characters shared while missing each other # item:echo_05 # pick:a]
-> END
* [Admire how the clues fit together # item:echo_05 # pick:b]
-> END

=== echo_choose_06 ===
Echo: The end of this village legend is blank.
Echo: How should we share this story?
* [Preserve the book behind glass # item:echo_06 # pick:a]
-> END
* [Let readers add their own endings # item:echo_06 # pick:b]
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
