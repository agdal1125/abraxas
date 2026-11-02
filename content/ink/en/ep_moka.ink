-> END

=== moka_meet ===
B: This walnut bread just came out of the oven. Could you take it to the workshop up the hill?
B: Here's the basket. When you get back, let's arrange the display together.
* [Run up the steep shortcut to deliver it warm # item:moka_01 # pick:a]
* [Take the gentler path to keep it from getting crushed # item:moka_01 # pick:b]
-
-> END

=== moka_pick_up ===
The basket of walnut bread is waiting outside the bakery.
-> END

=== moka_deliver ===
Take the basket of walnut bread to the stand outside the smithy.
-> END

=== moka_delivered ===
v1j2: You're from the bakery. I've been waiting for you.
v1j2: Thank you. I was getting hungry at work, so you've come at just the right time.
-> END

=== moka_reservation ===
A regular has come for bread they ordered yesterday, but the ledger lists a different kind.
B: What should we do?
* [Check the order with them # item:moka_02 # pick:a]
* [Reassure them and give them the bread they asked for # item:moka_02 # pick:b]
-
-> END

=== moka_reservation_action ===
Follow through by checking the ledger or giving the customer their bread.
-> END

=== moka_choose_display ===
B: Welcome back! Shall we put these breads on display now?
Stacking them high makes them easy to see, but they could fall.
* [Stack one layer safely # item:moka_03 # pick:a]
* [Try a taller three-layer display # item:moka_03 # pick:b]
-
-> END

=== moka_arrange ===
B: Take your time. If it's confusing, we can look together.
Choose a bread, then choose a place with the same shape.
-> END

=== moka_share ===
B: That's everything. Thanks to your help, we're ready for our customers.
Some tasting bread is left. A tasting guide and a tired neighbor are nearby.
B: How should we share the bread that's left?
* [Offer it first to a tired neighbor # item:moka_04 # pick:a]
* [Cut equal portions for everyone # item:moka_04 # pick:b]
-
-> END

=== moka_share_action ===
Follow through by giving the neighbor bread or putting it on the plate.
-> END

=== moka_order ===
B: How many special pies should we prepare for tonight's festival?
* [Bake extra for a possible rush # item:moka_05 # pick:a]
* [Bake the reserved amount to avoid waste # item:moka_05 # pick:b]
-
-> END

=== moka_order_action ===
Pick up the dough preparation bundle for the amount you chose.
-> END

=== moka_return ===
The dough is ready to prepare. Return to B at the bakery.
-> END

=== moka_feedback ===
B: The flower cookies I practiced came out a little crooked. What do you think?
* [Point out what may have caused the tilt # item:moka_06 # pick:a]
* [Praise the care and delicious aroma # item:moka_06 # pick:b]
-
-> END

=== moka_report ===
Finish talking with B about the errand.
-> END

=== moka_completed ===
B: Thank you for helping. The bakery feels a little warmer today because of you.
-> END
