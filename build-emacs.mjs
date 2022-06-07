import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { VersionLessThanOrEqual } from "./version.mjs";
import { cmd } from "./cmd.mjs";

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

async function build(version) {
  let extra_args = [];
  let make_args = [];
  let toolkit = "gtk";
  if (VersionLessThanOrEqual("24", version)) {
    toolkit = "gtk3";
    extra_args = [...extra_args, "--without-selinux"];
  }
  if (VersionLessThanOrEqual("25", version)) {
    // await cmd("sudo", "apt-get", "-y", "install", "libwebkit2gtk-4.0");
    extra_args = [
      ...extra_args,
      // "--with-xwidgets",
      "--with-modules",
    ];
  }
  if (VersionLessThanOrEqual("27", version)) {
    await cmd("sudo", "apt-get", "-y", "install", "libjansson-dev");
    extra_args = [...extra_args, "--with-cairo", "--with-harfbuzz"];
  }
  if (VersionLessThanOrEqual("28", version)) {
    await cmd("sudo", "apt-get", "-y", "install", "libgccjit-9-dev");
    extra_args = [...extra_args, "--with-native-compilation"];
    make_args = ["NATIVE_FULL_AOT=1", "bootstrap"];
  }
  if (VersionLessThanOrEqual("29", version)) {
    // Emacs 29 adds native WebP support
    await cmd("sudo", "apt-get", "-y", "install", "libwebp-dev");
  }
  await cmd("ls");
  // Emacs <= 24.1 (not sure about 24.2~24.5) ship ./configure with
  // the tarball and do not include ./autogen.sh.
  if (fs.existsSync("./autogen.sh")) {
    await cmd("./autogen.sh");
  }
  await cmd(
    "./configure",
    "--prefix=/app",
    `--with-x-toolkit=${toolkit}`,
    "--with-xft",
    ...extra_args
  );
  await cmd("make", ...make_args);
}
console.log("Adding deb-src entries for apt-get build-dep");
await cmd(
  "sudo",
  "sed",
  "-Ei",
  "/.*partner/! s/^# (deb-src .*)/\\1/g",
  "/etc/apt/sources.list"
);

spawnSync("sudo", ["apt-get", "update"]);
spawnSync("sudo", ["apt-get", "-y", "build-dep", "emacs-gtk"]);

if (!fs.existsSync(`emacs-${version}`)) {
  spawnSync("wget", [
    "-c",
    `http://ftpmirror.gnu.org/emacs/emacs-${version}.tar.gz`,
  ]);
  await cmd("tar", "xf", `emacs-${version}.tar.gz`);
}

console.log("Current directory content:");
fs.readdirSync(".");

if (["23.2b", "21.4a"].indexOf(version) != -1) {
  process.chdir(`emacs-${version.slice(0, -1)}`);
} else {
  process.chdir(`emacs-${version}`);
}

await build(version);
await cmd("sudo", "make", "install");
process.chdir(`..`);
