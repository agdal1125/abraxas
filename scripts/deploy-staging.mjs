// Deploys the staging environment. Setup: docs/design/staging-deploy.md
//   npm run deploy:staging            run every step
//   npm run deploy:staging -- --dry-run   print the commands only
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contentVersion } from "./content-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.staging");
const dryRun = process.argv.includes("--dry-run");
const REGION = "asia-northeast3";
const SERVICE = "abraxas-api";
const REPOSITORY = "abraxas";
const API_URL_PATH = "/v1/plays/current";

function run(command, args, { env, capture = false, allowFailure = false } = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  if (dryRun) return { ok: true, stdout: "" };
  // gcloud and npx are .cmd shims on Windows, which spawn cannot start without a shell.
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", shell: process.platform === "win32", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit" });
  const ok = !result.error && result.status === 0;
  if (!ok && !allowFailure) throw new Error(`${command} ${args[0]} failed`);
  return { ok, stdout: result.stdout ?? "" };
}

function loadSettings() {
  if (dryRun) return { project: "dry-run-project", siteKey: "dry-run-site-key" };
  if (!existsSync(envFile)) throw new Error(".env.staging is missing; see docs/design/staging-deploy.md");
  process.loadEnvFile(envFile);
  const { ABRAXAS_STAGING_PROJECT: project, ABRAXAS_STAGING_APP_CHECK_SITE_KEY: siteKey } = process.env;
  if (!project || !siteKey) throw new Error(".env.staging needs ABRAXAS_STAGING_PROJECT and ABRAXAS_STAGING_APP_CHECK_SITE_KEY");
  return { project, siteKey };
}

function requireCleanTree() {
  // A dirty tree would ship a client and server that no commit can reproduce.
  const { stdout } = run("git", ["status", "--porcelain", "--untracked-files=no"], { capture: true });
  if (stdout.trim()) throw new Error("Commit or stash tracked changes before deploying");
}

function webConfig(project) {
  const { stdout } = run("npx", ["--no-install", "firebase", "apps:sdkconfig", "WEB", "--project", project, "--json"], { capture: true });
  if (dryRun) return { apiKey: "dry-run", authDomain: "dry-run", appId: "dry-run" };
  const config = JSON.parse(stdout).result?.sdkConfig;
  if (!config?.apiKey || !config.appId || !config.authDomain) throw new Error("The Firebase project has no complete web app config");
  return config;
}

function buildClient(project, siteKey) {
  const config = webConfig(project);
  const env = {
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_PROJECT_ID: project,
    VITE_FIREBASE_APP_ID: config.appId,
    VITE_FIREBASE_APP_CHECK_SITE_KEY: siteKey
  };
  run("npm", ["--prefix", "client", "run", "build"], { env });
  run("npm", ["--prefix", "client", "run", "check:size"]);
}

function enableServices(project) {
  run("gcloud", ["services", "enable", "run.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com", "firestore.googleapis.com", "--project", project]);
}

function ensureRepository(project) {
  const scope = ["--location", REGION, "--project", project];
  if (run("gcloud", ["artifacts", "repositories", "describe", REPOSITORY, ...scope], { capture: true, allowFailure: true }).ok && !dryRun) return;
  run("gcloud", ["artifacts", "repositories", "create", REPOSITORY, "--repository-format=docker", ...scope]);
}

function ensureServiceAccount(project) {
  const email = `${SERVICE}@${project}.iam.gserviceaccount.com`;
  if (!run("gcloud", ["iam", "service-accounts", "describe", email, "--project", project], { capture: true, allowFailure: true }).ok || dryRun) {
    run("gcloud", ["iam", "service-accounts", "create", SERVICE, "--display-name", "AbraxasAPI", "--project", project]);
  }
  run("gcloud", ["projects", "add-iam-policy-binding", project, "--member", `serviceAccount:${email}`, "--role", "roles/datastore.user", "--condition=None", "--quiet"], { capture: true });
  return email;
}

function buildImage(project) {
  const { stdout } = run("git", ["rev-parse", "--short", "HEAD"], { capture: true });
  const image = `${REGION}-docker.pkg.dev/${project}/${REPOSITORY}/api:${stdout.trim() || "dry-run"}`;
  run("gcloud", ["builds", "submit", ".", "--config", "server/cloudbuild.yaml", `--substitutions=_IMAGE=${image}`, "--project", project]);
  return image;
}

function deployService(project, image, serviceAccount, version) {
  run("gcloud", ["run", "deploy", SERVICE, "--image", image, "--region", REGION, "--service-account", serviceAccount, "--allow-unauthenticated", "--min-instances", "0", "--max-instances", "3", "--memory", "256Mi", "--set-env-vars", `ABRAXAS_STORE=firestore,GOOGLE_CLOUD_PROJECT=${project},ABRAXAS_CONTENT_VERSION=${version}`, "--project", project]);
}

async function checkRewrite(project) {
  const url = `https://${project}.web.app${API_URL_PATH}`;
  console.log(`> GET ${url}`);
  if (dryRun) return;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (response.status !== 401 || body?.error !== "unauthenticated") throw new Error(`Expected the API's 401 through Hosting, got ${response.status}`);
  console.log(`Staging is live: https://${project}.web.app`);
}

const { project, siteKey } = loadSettings();
const version = contentVersion(root);
requireCleanTree();
enableServices(project);
buildClient(project, siteKey);
ensureRepository(project);
const serviceAccount = ensureServiceAccount(project);
const image = buildImage(project);
deployService(project, image, serviceAccount, version);
run("npx", ["--no-install", "firebase", "deploy", "--only", "hosting,firestore:rules", "--project", project]);
await checkRewrite(project);
