// Runs `cargo clean` on src-tauri with ~/.cargo/bin on PATH (see dev.mjs for why it is prepended).
// Extra args are forwarded, e.g. `node scripts/clean.mjs --profile dev`.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const env = { ...process.env };
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
env[pathKey] = `${join(homedir(), ".cargo", "bin")}${delimiter}${env[pathKey] ?? ""}`;

const args = ["clean", "--manifest-path", "src-tauri/Cargo.toml", ...process.argv.slice(2)];
const child = spawn("cargo", args, { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
