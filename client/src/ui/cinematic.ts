import "./cinematic.css";

export function playPrelude(
  host: HTMLElement,
  lang: "ko" | "en",
  copy: { play: string; pause: string; skip: string; mute: string; unmute: string; fallback: string },
): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "cinematic";
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "none";
    const message = document.createElement("p");
    const playback = document.createElement("button");
    const sound = document.createElement("button");
    const skip = document.createElement("button");
    playback.type = sound.type = skip.type = "button";
    playback.textContent = copy.play;
    sound.textContent = copy.unmute;
    skip.textContent = copy.skip;
    overlay.append(video, message, playback, sound, skip);
    host.append(overlay);

    let fallback = false;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", showFallback);
      playback.removeEventListener("click", togglePlayback);
      sound.removeEventListener("click", toggleSound);
      skip.removeEventListener("click", finish);
      video.pause();
      video.removeAttribute("src");
      overlay.remove();
      resolve();
    };
    const showFallback = () => {
      if (finished || fallback) return;
      fallback = true;
      clearTimeout(timer);
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      sound.hidden = true;
      message.textContent = copy.fallback;
      playback.textContent = lang === "ko" ? "계속" : "Continue";
    };
    const onPlaying = () => { clearTimeout(timer); playback.textContent = copy.pause; };
    const onPause = () => { playback.textContent = copy.play; };
    const start = () => { void video.play().catch(() => { if (!finished && !fallback) playback.textContent = copy.play; }); };
    const togglePlayback = () => {
      if (fallback) finish();
      else if (video.paused) start();
      else video.pause();
    };
    const toggleSound = () => {
      video.muted = !video.muted;
      sound.textContent = video.muted ? copy.unmute : copy.mute;
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", finish);
    video.addEventListener("error", showFallback);
    playback.addEventListener("click", togglePlayback);
    sound.addEventListener("click", toggleSound);
    skip.addEventListener("click", finish);
    overlay.lang = lang;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showFallback();
    } else {
      timer = setTimeout(showFallback, 10_000);
      video.src = `${import.meta.env.BASE_URL}cinematics/prelude-v3.mp4`;
      start();
    }
  });
}
