import { expect, it } from "vitest";
import { installGuideFor, type DisplayEnv } from "./install-guide";

const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1";
const IPHONE_KAKAO = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.9.0";
const phone: DisplayEnv = { userAgent: IPHONE_CHROME, fullscreenAvailable: false, coarsePointer: true, standalone: false };

it.each<[string, Partial<DisplayEnv>, ReturnType<typeof installGuideFor>]>([
  ["iPhone browser", {}, "home-screen"],
  ["KakaoTalk in-app browser", { userAgent: IPHONE_KAKAO }, "open-browser"],
  ["already on the home screen", { standalone: true }, null],
  ["browser with the fullscreen API", { fullscreenAvailable: true }, null],
  ["desktop mouse", { coarsePointer: false }, null],
])("%s", (_, env, guide) => {
  expect(installGuideFor({ ...phone, ...env })).toBe(guide);
});
