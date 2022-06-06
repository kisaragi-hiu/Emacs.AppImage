import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { VersionLessThanOrEqual } from "./version.mjs";

function cmd(...command) {
  console.log(command);
  let p = spawn(command[0], command.slice(1));
  return new Promise((resolveFunc) => {
    p.stdout.on("data", (x) => {
      process.stdout.write(x.toString());
    });
    p.stderr.on("data", (x) => {
      process.stderr.write(x.toString());
    });
    p.on("exit", (code) => {
      resolveFunc(code);
    });
  });
}

function print_help() {
  console.log(`
node build-emacs.mjs <version>

<version>: Something like 28.1, 27.2, 26.3...
See http://ftpmirror.gnu.org/emacs/ for a list of all versions.
`);
}

let version = process.argv[2];

if (!version) {
  print_help();
  process.exit(1);
}

let all_args = ["--prefix=/app", "--with-x-toolkit=gtk3", "--with-xft"];
let extra_args = [];
let make_args = [];

async function build(version) {
  await cmd("ls");
  await cmd("./autogen.sh");
  if (VersionLessThanOrEqual("24", version)) {
    extra_args = [...extra_args, "--without-selinux"];
  }
  if (VersionLessThanOrEqual("25", version)) {
    // await cmd("sudo", "apt-get", "-y", "libwebkit2gtk-4.0");
    extra_args = [
      ...extra_args,
      // "--with-xwidgets",
      "--with-modules",
    ];
  }
  if (VersionLessThanOrEqual("27", version)) {
    await cmd("sudo", "apt-get", "-y", "libjansson4");
    extra_args = [...extra_args, "--with-cairo", "--with-harfbuzz"];
  }
  if (VersionLessThanOrEqual("28", version)) {
    extra_args = [...extra_args, "--with-with-native-compilation"];
    make_args = ["NATIVE_FULL_AOT=1", "bootstrap"];
  }
  await cmd("./configure", ...all_args, ...extra_args);
  await cmd("make", ...make_args);
}

if (!fs.existsSync(`emacs-${version}`)) {
  spawnSync("wget", [
    "-c",
    `http://ftpmirror.gnu.org/emacs/emacs-${version}.tar.gz`,
  ]);
  await cmd("tar", "xf", `emacs-${version}.tar.gz`);
}

console.log("Adding deb-src entries for apt-get build-dep");
await cmd(
  "sudo",
  "sed",
  "-Ei",
  "/.*partner/! s/^# (deb-src .*)/\\1/g",
  "/etc/apt/sources.list"
);

console.log("New /etc/apt/sources.list content:");
await cmd("cat", "/etc/apt/sources.list");

await cmd("sudo", "apt-get", "update");
await cmd("sudo", "apt-get", "-y", "build-dep", "emacs-gtk");

process.chdir(`emacs-${version}`);
await build(version);
await cmd("sudo", "make", "install");
process.chdir(`..`);
fs.copyFileSync("AppRun", path.join(os.homedir(), "AppRun"));

// This should put the finished AppImage in ./build/Emacs/out/
await cmd("bash", "-ex", "appimage.sh", version);
