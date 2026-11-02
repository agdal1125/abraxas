import { DevAuthTokenSource, type AuthTokenSource } from "./auth";

export async function createAuthSource(): Promise<AuthTokenSource> {
  if (import.meta.env.DEV && import.meta.env.VITE_ABRAXAS_DEV_FAKE_AUTH === "1") return new DevAuthTokenSource();
  // Firebase anonymous authentication will be connected by ER1-E.
  return { getIdToken: async () => { throw new Error("auth_unavailable"); } };
}
