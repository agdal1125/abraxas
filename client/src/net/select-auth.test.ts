import { afterEach, expect, test, vi } from "vitest";
import { DevAuthTokenSource } from "./auth";
import { createAuthSource } from "./select-auth";

afterEach(() => vi.unstubAllEnvs());

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
