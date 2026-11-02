VAR local_story = false
~ local_story = true
-> lumi_choose_01

=== lumi_choose_01 ===
Lumi: Hi! I'm Lumi. I'm helping organize the festival.
You: Hi. My memory's hazy. I'm not even sure where I am.
Lumi: You can't remember? That must feel strange. If you'd like, we could get ready for the festival together.
Lumi points to the ribbons and flowers in the tent.
* [Tie ribbons quietly at a table # item:lumi_01 # pick:a]
* [Join the group weaving flower garlands # item:lumi_01 # pick:b]
-
{ local_story: -> lumi_choose_02 }
-> END

=== lumi_choose_02 ===
Lumi lays out two ideas for the stage.
* [Put on a new colorful shadow play # item:lumi_02 # pick:a]
* [Continue the traditional lantern play # item:lumi_02 # pick:b]
-
{ local_story: -> lumi_choose_03 }
-> END

=== lumi_choose_03 ===
Lumi: We need to spread the festival's start time. Here are the notices and the horn.
* [Tell villagers in the market streets # item:lumi_03 # pick:a]
* [Post notices on boards and mailboxes # item:lumi_03 # pick:b]
-
{ local_story: -> lumi_choose_04 }
-> END

=== lumi_choose_04 ===
One garland is missing from a stage post. Choose materials with Lumi.
* [Fetch familiar ribbons from storage # item:lumi_04 # pick:a]
* [Weave something new from leaves and pinecones # item:lumi_04 # pick:b]
-
{ local_story: -> lumi_choose_05 }
-> END

=== lumi_choose_05 ===
Lumi: The guests will be here soon. How should we welcome them?
* [Hand out welcome cards by the entrance # item:lumi_05 # pick:a]
* [Call out greetings from the square # item:lumi_05 # pick:b]
-
{ local_story: -> lumi_choose_06 }
-> END

=== lumi_choose_06 ===
The musicians lay out two scores for the opening march.
* [Start with their lively new song # item:lumi_06 # pick:a]
* [Start with the village’s familiar old march # item:lumi_06 # pick:b]
-
-> END

=== lumi_table ===
Make decorations at the chosen table.
-> END

=== lumi_card ===
Place the chosen performance card on the stage plan.
-> END

=== lumi_notice_pickup ===
Pick up the chosen notice tool.
-> END

=== lumi_notice_first ===
Share the festival news at the first stop.
-> END

=== lumi_notice_second ===
Share the festival news at the second stop.
-> END

=== lumi_notice_first_a ===
Neighbor: Thanks for telling me. I'll come when it starts.
-> END

=== lumi_notice_second_a ===
Neighbor: Festival news! I'll remember.
-> END

=== lumi_notice_first_b ===
You post a notice on the board.
-> END

=== lumi_notice_second_b ===
You leave a notice at the mailbox.
-> END

=== lumi_notice_return ===
Return the notice tool.
-> END

=== lumi_stagekeeper ===
Stagehand: We're short one garland for the post. Could you find more material?
-> END

=== lumi_material_pickup ===
Pick up the chosen decoration material.
-> END

=== lumi_material_delivery ===
Bring the material to the stage workbench.
-> END

=== lumi_arrange ===
Hang the decorations by matching each loop to its shape.
-> END

=== lumi_welcome ===
Welcome guests at the chosen place.
-> END

=== lumi_return ===
Return to Lumi.
-> END

=== lumi_score_pickup ===
Pick up the chosen march score.
-> END

=== lumi_score_delivery ===
Bring the score to the musicians' stand.
-> END

=== lumi_report ===
Tell Lumi the preparations are finished.
-> END

=== lumi_completed ===
Lumi: Thank you for helping. Take a rest, and I'll see you at the festival.
-> END
