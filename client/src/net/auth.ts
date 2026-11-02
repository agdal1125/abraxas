export interface AuthTokenSource {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export interface AppCheckTokenSource {
  getToken(): Promise<string>;
}

export class DevAuthTokenSource implements AuthTokenSource {
  async getIdToken(): Promise<string> {
    if (!import.meta.env.DEV || import.meta.env.VITE_ABRAXAS_DEV_FAKE_AUTH !== "1") throw new Error("dev_auth_disabled");
    try {
      const key = "abraxas:dev-uid";
      let uid = localStorage.getItem(key);
      if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem(key, uid);
        if (localStorage.getItem(key) !== uid) throw new Error("storage_unavailable");
      }
      return `dev-${uid}`;
    } catch {
      throw new Error("dev_auth_storage_unavailable");
    }
  }
}
