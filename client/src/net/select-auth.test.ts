import { afterEach, expect, test, vi } from "vitest";
import { DevAuthTokenSource } from "./auth";
import { createAuthSource } from "./select-auth";

const firebase = vi.hoisted(() => ({ signIn: vi.fn(), connect: vi.fn(), currentUser: null as null | { getIdToken: () => Promise<string> } }));
const configure = vi.hoisted(() => vi.fn());
vi.mock("../scenes/village", () => ({ Village: class { whenReady = Promise.resolve(); } }));
vi.mock("../ui/game", () => ({ Game: class {} }));
vi.mock("./plays", () => ({ configurePlayTransport: configure }));
vi.mock("firebase/app", () => ({ initializeApp: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => firebase,
  signInAnonymously: firebase.signIn,
  connectAuthEmulator: firebase.connect,
}));
vi.mock("firebase/app-check", () => ({
  ReCaptchaV3Provider: class {},
  initializeAppCheck: () => ({}),
  getToken: async () => ({ token: "demo-check" }),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("selects development authentication when explicitly enabled", async () => {
  vi.stubEnv("VITE_ABRAXAS_DEV_FAKE_AUTH", "1");
  vi.stubEnv("VITE_FIREBASE_API_KEY", "");
  expect((await createAuthSource()).auth).toBeInstanceOf(DevAuthTokenSource);
});

test("reports unavailable authentication when Firebase configuration is missing", async () => {
  vi.stubEnv("VITE_ABRAXAS_DEV_FAKE_AUTH", "0");
  vi.stubEnv("VITE_FIREBASE_API_KEY", "");
  const source = await createAuthSource();
  await expect(source.auth.getIdToken()).rejects.toThrow("auth_unavailable");
  expect(source.appCheck).toBeUndefined();
});

test("retries anonymous sign-in after a transient failure", async () => {
  vi.stubEnv("VITE_ABRAXAS_DEV_FAKE_AUTH", "0");
  vi.stubEnv("VITE_FIREBASE_API_KEY", "demo-key");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "demo-abraxas");
  vi.stubEnv("VITE_FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
  firebase.currentUser = null;
  firebase.connect.mockReset();
  Object.assign(firebase, { authStateReady: async () => {} });
  firebase.signIn.mockReset().mockRejectedValueOnce(new Error("offline")).mockImplementationOnce(async () => {
    firebase.currentUser = { getIdToken: async () => "demo-token" };
  });
  const source = await createAuthSource();
  await expect(source.auth.getIdToken()).rejects.toThrow("offline");
  await expect(source.auth.getIdToken()).resolves.toBe("demo-token");
  expect(firebase.connect).toHaveBeenCalledTimes(1);
});

test("does not enable App Check debug mode for an auth emulator", async () => {
  vi.stubEnv("VITE_ABRAXAS_DEV_FAKE_AUTH", "0");
  vi.stubEnv("VITE_FIREBASE_API_KEY", "demo-key");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "demo-abraxas");
  vi.stubEnv("VITE_FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
  vi.stubEnv("VITE_FIREBASE_APP_CHECK_SITE_KEY", "demo-site-key");
  const source = await createAuthSource();
  await expect(source.appCheck?.getToken()).resolves.toBe("demo-check");
  expect((globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
});

test("startup defers authentication and preserves retry and App Check", async () => {
  vi.stubEnv("VITE_ABRAXAS_DEV_FAKE_AUTH", "0");
  vi.stubEnv("VITE_FIREBASE_API_KEY", "demo-key");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "demo-abraxas");
  vi.stubEnv("VITE_FIREBASE_APP_CHECK_SITE_KEY", "demo-site-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_EMULATOR_HOST", "");
  firebase.currentUser = null;
  firebase.signIn.mockReset().mockRejectedValueOnce(new Error("offline")).mockImplementationOnce(async () => {
    firebase.currentUser = { getIdToken: async () => "demo-token" };
  });
  Object.assign(firebase, { authStateReady: async () => {} });
  configure.mockReset();
  const element = () => ({ style: {}, classList: { add() {} }, append() {}, setAttribute() {}, remove() {} });
  vi.stubGlobal("document", { querySelector: element, createElement: element, body: element(), documentElement: {}, addEventListener() {} });
  vi.stubGlobal("window", { innerWidth: 844, innerHeight: 390, addEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: true }) });
  await import("../main");
  await vi.waitFor(() => expect(configure).toHaveBeenCalledTimes(1));
  expect(firebase.signIn).not.toHaveBeenCalled();
  const auth = configure.mock.calls[0]![0].auth;
  await expect(auth.getIdToken()).rejects.toThrow("offline");
  expect(configure).toHaveBeenCalledTimes(2);
  await expect(auth.getIdToken()).resolves.toBe("demo-token");
  await expect(configure.mock.calls[1]![0].appCheck.getToken()).resolves.toBe("demo-check");
});
