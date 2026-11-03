-> echo_choose_01

=== echo_choose_01 ===
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

=== echo_enclose ===
Tuck the chosen note into the picture book.
-> END

=== echo_book_pickup ===
Pick up the bundle of picture books.
-> END

=== echo_book_delivery ===
Deliver the picture book to the borrower.
-> END

=== echo_search ===
Examine the chosen shelves or the attic door.
-> END

=== echo_record_pickup ===
Pick up the festival chronicle you found.
-> END

=== echo_record_delivery ===
Bring the chronicle to the reading table.
-> END

=== echo_notebook_pickup ===
Pick up the recipe notebook.
-> END

=== echo_notebook_delivery ===
Place the recipe notebook in the chosen spot.
-> END

=== echo_organizer ===
Book Keeper: Shall we find where these books belong?
-> END

=== echo_arrange ===
Pick a book, then place it by its matching topic sign.
-> END

=== echo_reading ===
Book Keeper: While sorting, I found an old story.
Echo joins you at the table and opens the volume.
A letter from a sister far away reads:
'I miss you. When spring comes, I'll return.'
The older sister checked dates and bridge repairs.
Come spring, they met once more upon that bridge.
-> END

=== echo_bookmark ===
Place a bookmark at the passage you liked best.
-> END

=== echo_return ===
Return to Echo.
-> END

=== echo_legend_pickup ===
Pick up the book of legends.
-> END

=== echo_legend_delivery ===
Place the legend book on the chosen display.
-> END

=== echo_report ===
Tell Echo the sorting is complete.
-> END

=== echo_completed ===
Echo: Thank you for looking after the books with me.
Echo: See you again at the festival.
-> END
