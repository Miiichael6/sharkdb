// Runs `tauri dev` with ~/.cargo/bin on PATH. It is prepended because a malformed PATH entry
// (e.g. a stray quote) makes Windows skip every entry after it.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const env = { ...process.env };
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
env[pathKey] = `${join(homedir(), ".cargo", "bin")}${delimiter}${env[pathKey] ?? ""}`;

const child = spawn("npm", ["run", "tauri", "dev"], { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
