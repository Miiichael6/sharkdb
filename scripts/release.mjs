// Publishes a new version as a GitHub release the in-app updater finds, in one command:
//   npm run release -- <patch|minor|major|x.y.z> "Qué trae esta versión"
//   npm run release -- --local [patch|minor|major|x.y.z]     ← only builds; nothing is committed or published
// Bumps package.json, builds the signed NSIS installer, leaves it in releases/ with its .sig and latest.json,
// then commits and tags the version, pushes main and creates the release with `gh`.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = "Miiichael6/sharkdb";
const MAIN_BRANCH = "main";
const BUNDLE_DIR = join("src-tauri", "target", "release", "bundle", "nsis");
const OUTPUT_DIR = "releases";
const DEFAULT_KEY = join(homedir(), ".tauri", "sharkdb.key");
const CARGO_TOML = join("src-tauri", "Cargo.toml");
// package.json holds the version; Cargo.toml gets a copy because Windows shows it in the .exe's properties.
const VERSION_FILES = ["package.json", "package-lock.json", CARGO_TOML, join("src-tauri", "Cargo.lock")];
const USAGE = 'Uso: npm run release -- <patch|minor|major|x.y.z> "notas"   (o --local [versión] para solo compilar)';

/** Copies the version to Cargo.toml's [package]; the build then updates Cargo.lock. */
function syncCargoVersion(version) {
  const toml = readFileSync(CARGO_TOML, "utf8");
  writeFileSync(CARGO_TOML, toml.replace(/^version = ".*"$/m, `version = "${version}"`));
}

const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "inherit", ...options });
const output = (command, args) => execFileSync(command, args, { encoding: "utf8" }).trim();
// npm is a .cmd on Windows: only a shell runs it (its arguments here have no spaces, so none get split).
const npm = (args, options = {}) => run("npm", args, { shell: process.platform === "win32", ...options });

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const local = argv.includes("--local");
  const [bump, ...notes] = argv.filter((a) => a !== "--local");
  if (!bump && local) return { bump: null, local, notes: "" };
  if (!bump || !/^(patch|minor|major|\d+\.\d+\.\d+)$/.test(bump)) fail(USAGE);
  return { bump, local, notes: notes.join(" ") };
}

/** Everything that would make the release fail halfway, checked before touching anything. */
function checkReady(local) {
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !existsSync(DEFAULT_KEY)) {
    fail(`No está la clave privada en ${DEFAULT_KEY} (ni TAURI_SIGNING_PRIVATE_KEY definida)`);
  }
  if (local) return;
  if (output("git", ["status", "--porcelain"])) fail("Hay cambios sin commitear: haz commit o descártalos antes.");
  const branch = output("git", ["branch", "--show-current"]);
  if (branch !== MAIN_BRANCH) fail(`Estás en '${branch}': las versiones se publican desde '${MAIN_BRANCH}'.`);
  try {
    output("gh", ["auth", "status"]);
  } catch {
    fail("gh no tiene sesión: ejecuta `gh auth login`.");
  }
}

/** `tauri build` signs with the private key; the default one is used unless the environment names another. */
function signingEnv() {
  const env = { ...process.env };
  env.TAURI_SIGNING_PRIVATE_KEY ??= DEFAULT_KEY;
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= "";
  return env;
}

/** The manifest the updater reads at releases/latest/download/latest.json. */
function latestJson(version, notes, installer, signature) {
  return {
    version,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature,
        url: `https://github.com/${REPO}/releases/download/v${version}/${installer}`,
      },
    },
  };
}

/** Builds the signed installer and copies it, its signature and latest.json to releases/; returns their paths. */
function buildInstaller(version, notes) {
  npm(["run", "tauri", "build"], { env: signingEnv() });
  const installer = `SharkDB_${version}_x64-setup.exe`;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const exe = join(OUTPUT_DIR, installer);
  copyFileSync(join(BUNDLE_DIR, installer), exe);
  copyFileSync(join(BUNDLE_DIR, `${installer}.sig`), `${exe}.sig`);
  const manifest = join(OUTPUT_DIR, "latest.json");
  const signature = readFileSync(`${exe}.sig`, "utf8").trim();
  writeFileSync(manifest, JSON.stringify(latestJson(version, notes, installer, signature), null, 2));
  return [exe, `${exe}.sig`, manifest];
}

function publish(version, notes, files) {
  const tag = `v${version}`;
  if (output("git", ["status", "--porcelain", "--", ...VERSION_FILES])) {
    run("git", ["commit", "-m", `chore(release): ${tag}`, "--", ...VERSION_FILES]);
  }
  run("git", ["tag", tag]);
  run("git", ["push", "origin", MAIN_BRANCH, tag]);
  run("gh", ["release", "create", tag, ...files, "--repo", REPO, "--title", `SharkDB ${version}`, "--notes", notes]);
}

const { bump, local, notes: givenNotes } = parseArgs(process.argv.slice(2));
checkReady(local);

const originals = VERSION_FILES.map((file) => [file, readFileSync(file, "utf8")]);
// --allow-same-version: the first release publishes the version package.json already has.
if (bump) npm(["version", bump, "--no-git-tag-version", "--allow-same-version"]);
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
syncCargoVersion(version);
const notes = givenNotes || `SharkDB ${version}`;

let files;
try {
  files = buildInstaller(version, notes);
} catch {
  for (const [file, content] of originals) writeFileSync(file, content);
  fail("El build falló: package.json vuelve a la versión anterior.");
}
console.log(`\n✓ Instalador en ${files[0]}`);

if (local) {
  console.log(`--local: no se ha hecho commit ni publicado nada${bump ? ` (package.json queda en ${version})` : ""}.`);
} else {
  publish(version, notes, files);
  console.log(`\n✓ Publicada https://github.com/${REPO}/releases/tag/v${version}`);
}
