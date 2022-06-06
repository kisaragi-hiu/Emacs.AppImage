import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { VersionLessThanOrEqual } from "./version.mjs";

function cmd(...command) {
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
  await cmd("autogen.sh");
  if (VersionLessThanOrEqual("24", version)) {
    extra_args = [...extra_args, "--without-selinux"];
  }
  if (VersionLessThanOrEqual("25", version)) {
    extra_args = [...extra_args, "--with-modules"];
  }
  if (VersionLessThanOrEqual("27", version)) {
    await cmd("sudo", "apt-get", "-y", "libjansson4");
    extra_args = [...extra_args, "--with-cairo", "--with-harfbuzz"];
  }
  if (VersionLessThanOrEqual("28", version)) {
    extra_args = [...extra_args, "--with-with-native-compilation"];
    make_args = ["NATIVE_FULL_AOT=1", "bootstrap"];
  }
  await cmd("configure", ...all_args, ...extra_args);
  await cmd("make", ...make_args);
}

// await cmd("sudo", "apt-get", "-y", "build-dep", "emacs-gtk");

await cmd(
  "wget",
  "-c",
  `http://ftpmirror.gnu.org/emacs/emacs-${version}.tar.gz`
);
await cmd("tar", "xf", `emacs-${version}.tar.gz`);
process.chdir(`emacs-${version}`);
// build(version);
// await cmd("sudo", "make", "install");
// process.chdir(`..`);
// fs.copyFileSync("AppRun", path.join(os.homedir(), "AppRun"));

// This should put the finished AppImage in ./build/Emacs/out/
// await cmd("bash", "-ex", "appimage.sh", version);
