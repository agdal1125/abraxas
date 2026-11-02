import { DevAuthTokenSource, type AppCheckTokenSource, type AuthTokenSource } from "./auth";

export async function createAuthSource(): Promise<{ auth: AuthTokenSource; appCheck?: AppCheckTokenSource }> {
  if (import.meta.env.DEV && import.meta.env.VITE_ABRAXAS_DEV_FAKE_AUTH === "1") return { auth: new DevAuthTokenSource() };
  const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId,
    VITE_FIREBASE_AUTH_DOMAIN: authDomain, VITE_FIREBASE_AUTH_EMULATOR_HOST: emulator,
    VITE_FIREBASE_APP_CHECK_SITE_KEY: siteKey } = import.meta.env;
  if (!apiKey || !projectId) return { auth: { getIdToken: async () => { throw new Error("auth_unavailable"); } } };

  let appPromise: Promise<import("firebase/app").FirebaseApp> | undefined;
  const app = () => appPromise ??= import("firebase/app").then(({ initializeApp }) => initializeApp({ apiKey, projectId, appId, authDomain }));
  let authPromise: Promise<import("firebase/auth").Auth> | undefined;
  const auth = () => authPromise ??= Promise.all([app(), import("firebase/auth")]).then(async ([firebaseApp, sdk]) => {
    const instance = sdk.getAuth(firebaseApp);
    if (emulator) sdk.connectAuthEmulator(instance, `http://${emulator}`, { disableWarnings: true });
    await instance.authStateReady();
    if (!instance.currentUser) await sdk.signInAnonymously(instance);
    return instance;
  });
  const result: { auth: AuthTokenSource; appCheck?: AppCheckTokenSource } = {
    auth: { getIdToken: async forceRefresh => (await auth()).currentUser!.getIdToken(forceRefresh) }
  };
  if (siteKey) {
    let checkPromise: Promise<import("firebase/app-check").AppCheck> | undefined;
    const check = () => checkPromise ??= Promise.all([app(), import("firebase/app-check")]).then(([firebaseApp, sdk]) => {
      if (emulator) (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      return sdk.initializeAppCheck(firebaseApp, { provider: new sdk.ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
    });
    result.appCheck = { getToken: async () => (await (await import("firebase/app-check")).getToken(await check())).token };
  }
  return result;
}
