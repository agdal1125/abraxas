import { expect, it } from "vitest";
import { offerSwipeToHideToolbar } from "./soft-fullscreen";

class Node extends EventTarget {
  className = ""; textContent = ""; type = ""; hidden = false; children: Node[] = [];
  classes = new Set<string>();
  classList = { add: (name: string) => { this.classes.add(name); } };
  append(...children: Node[]) { this.children.push(...children); }
  setAttribute() {}
}

function phone() {
  const root = new Node(), body = new Node();
  const doc = { documentElement: root, body, createElement: () => new Node() };
  const win = Object.assign(new EventTarget(), { scrollY: 0, navigator: { language: "ko-KR" } });
  offerSwipeToHideToolbar(win as unknown as Window, doc as unknown as Document);
  const hint = body.children.find(child => child.className === "swipe-hint")!;
  const scrollTo = (y: number) => { win.scrollY = y; win.dispatchEvent(new Event("scroll")); };
  return { root, hint, scrollTo, skip: hint.children.at(-1)! };
}

it("asks for a swipe while the page is at the top and steps aside once it has scrolled", () => {
  const { root, hint, scrollTo } = phone();
  expect(root.classes.has("soft-fullscreen")).toBe(true);
  expect(hint.hidden).toBe(false);
  scrollTo(40);
  expect(hint.hidden).toBe(true);
  scrollTo(0); // a tap on the status bar scrolls back up and the bars return
  expect(hint.hidden).toBe(false);
});

it("stays away after the player skips it", () => {
  const { hint, scrollTo, skip } = phone();
  skip.dispatchEvent(new Event("click"));
  expect(hint.hidden).toBe(true);
  scrollTo(0);
  expect(hint.hidden).toBe(true);
});
