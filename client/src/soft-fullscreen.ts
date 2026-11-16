// iPhone browsers (Safari, and Chrome which runs on the same engine) have no element fullscreen. They do fold their
// address bar away while the page is scrolled down, so the page is made taller than the screen and the player is asked
// to swipe up once. The game box is position: fixed and follows the visible viewport, so it stays put while the page
// underneath scrolls. Tapping the status bar scrolls back to the top; the hint then comes back.

type Copy = { title: string; detail: string; install: string; skip: string };

const COPY: Record<"ko" | "en", Copy> = {
  ko: { title: "화면을 위로 밀어 올려 주세요", detail: "주소창이 접혀 화면이 넓어져요", install: "홈 화면에 추가하면 늘 전체 화면으로 열려요", skip: "그냥 할게요" },
  en: { title: "Swipe up", detail: "The address bar folds away and the screen gets bigger", install: "Add to Home Screen to always open full screen", skip: "Skip" },
};

export function offerSwipeToHideToolbar(win: Window = window, doc: Document = document): void {
  const copy = COPY[(win.navigator?.language ?? "ko").toLowerCase().startsWith("ko") ? "ko" : "en"];
  doc.documentElement.classList.add("soft-fullscreen");
  const spacer = doc.createElement("div"), hint = doc.createElement("div");
  const title = doc.createElement("strong"), detail = doc.createElement("span"), install = doc.createElement("small"), skip = doc.createElement("button");
  spacer.className = "soft-fullscreen-spacer"; spacer.setAttribute("aria-hidden", "true");
  hint.className = "swipe-hint"; hint.setAttribute("role", "status");
  title.textContent = copy.title; detail.textContent = copy.detail; install.textContent = copy.install;
  skip.type = "button"; skip.textContent = copy.skip;
  hint.append(title, detail, install, skip); doc.body.append(spacer, hint);

  let skipped = false;
  // Scrolled at all means the browser has folded its bars; back at the very top means they are showing again.
  const update = () => { hint.hidden = skipped || win.scrollY > 0; };
  skip.addEventListener("click", () => { skipped = true; update(); });
  win.addEventListener("scroll", update, { passive: true });
  win.addEventListener("resize", update);
  win.addEventListener("orientationchange", update);
  update();
}
