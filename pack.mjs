// 스토어 업로드용 zip. node pack.mjs -> dist/karmolab-<버전>.zip
// 담는 것: manifest 가 쓰는 파일만. README, 이 스크립트 제외
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from 'node:os';
import { storeManifest } from './dev/build.mjs';
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = storeManifest(JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")));
const { version } = manifest;
const files = ["manifest.json", "background.mjs", "_locales", "features", "icons", "popup.html", "popup.js"];

mkdirSync(join(root, "dist"), { recursive: true });
const out = join(root, "dist", `karmolab-${version}.zip`);
rmSync(out, { force: true });

// Windows 내장 tar (bsdtar) 의 -a 로 zip. PATH 의 tar 는 Git Bash GNU tar 가능성, 그래서 절대 경로
const winTar = join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
const staging = mkdtempSync(join(tmpdir(), 'karmolab-pack-'));
try {
  for (const file of files.filter(file => file !== 'manifest.json')) cpSync(join(root, file), join(staging, file), { recursive: true });
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  if (process.platform === "win32") execFileSync(winTar, ["-a", "-c", "-f", out, ...files], { cwd: staging, stdio: "inherit" });
  else execFileSync("zip", ["-r", out, ...files], { cwd: staging, stdio: "inherit" });
} finally { rmSync(staging, { recursive: true, force: true }); }

console.log(out);
