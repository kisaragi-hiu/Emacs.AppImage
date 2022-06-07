import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  VersionLessThanOrEqual,
  VersionLessThan,
  VersionBetween,
} from "./version.mjs";
import { cmd } from "./cmd.mjs";

function print_help() {
  console.log(`
node build-emacs.mjs <version>

<version>: Something like 28.1, 27.2, 26.3...
See http://ftpmirror.gnu.org/emacs/ for a list of all versions.
`);
}

let v = process.argv[2];

if (!v) {
  print_help();
  process.exit(1);
}

async function build(version) {
  let extra_args = [];
  let make_args = [];
  let toolkit = "";
  let extra_packages = [];
  // Emacs 23 / 24 need this
  extra_packages = ["libjpeg-dev", "libgif-dev", "libtiff-dev"];
  if (VersionLessThan(version, "22")) {
    toolkit = "lucid";
    extra_packages = [...extra_packages, "gcc-4.8", "libxpm-dev"];
    extra_args = [...extra_args, "CC=gcc-4.8"];
  } else if (VersionBetween("22", version, "23")) {
    toolkit = "gtk";
    extra_packages = [...extra_packages, "gcc-4.8", "libxpm-dev"];
    extra_args = [...extra_args, "CC=gcc-4.8"];
  } else if (VersionBetween("23", version, "24")) {
    toolkit = "gtk";
    extra_packages = [
      ...extra_packages,
      "gcc-4.8",
      "libxpm-dev",
      "libgconf2-dev",
      "libgpm-dev",
      "libm17n-dev",
      "libotf-dev",
    ];
    extra_args = [
      ...extra_args,
      "CC=gcc-4.8",
      // image.c:7540:3: error: too few arguments to function ‘DGifCloseFile’
      "--with-gif=no",
      "--with-crt-dir=/usr/lib/x86_64-linux-gnu",
    ];
  } else if (VersionBetween("24", version, "25")) {
    toolkit = "gtk3";
    extra_packages = [
      ...extra_packages,
      "gcc-4.8",
      "libxpm-dev",
      "libnss-myhostname",
    ];

    extra_args = [...extra_args, "CC=gcc-4.8"];
  }
  // Emacs 24 adds GTK3 and SELinux support
  // We want SELinux to be off
  if (VersionLessThanOrEqual("24", version)) {
    toolkit = "gtk3";
    extra_args = [...extra_args, "--without-selinux"];
  }
  // Emacs 25 adds native modules
  // Emacs 25 also adds xwidgets, but it seems to be demanding a
  // version of WebKitGTK that's too old, so only enable it in 26.
  if (VersionLessThanOrEqual("25", version)) {
    extra_args = [...extra_args, "--with-modules"];
  }
  if (VersionLessThanOrEqual("26", version)) {
    extra_packages = [...extra_packages, "libwebkit2gtk-4.0-dev"];
    extra_args = [...extra_args, "--with-xwidgets"];
  }
  if (VersionLessThanOrEqual("27", version)) {
    extra_packages = [...extra_packages, "libjansson-dev"];
    extra_args = [...extra_args, "--with-cairo", "--with-harfbuzz"];
  }
  if (VersionLessThanOrEqual("28", version)) {
    // extra_packages = [...extra_packages, "libgccjit-9-dev"];
    // extra_args = [...extra_args, "--with-native-compilation"];
    // make_args = ["NATIVE_FULL_AOT=1", "bootstrap"];
  }
  // Emacs 29 adds native WebP support
  if (VersionLessThanOrEqual("29", version)) {
    // extra_packages = [...extra_packages, "libwebp-dev"];
  }
  await cmd("ls");
  if (toolkit === "gtk") {
    extra_packages = [...extra_packages, "libgtk2.0-dev", "libglib2.0-dev"];
  } else if (toolkit === "gtk3") {
    extra_packages = [...extra_packages, "libgtk-3-dev"];
  }
  await cmd("sudo", "apt-get", "install", "-y", ...extra_packages);
  // Emacs <= 24.1 (not sure about 24.2~24.5) ship ./configure with
  // the tarball and do not include ./autogen.sh.
  if (fs.existsSync("./autogen.sh")) {
    await cmd("./autogen.sh");
  }
  await cmd(
    "env",
    "ac_cv_lib_gif_EGifPutExtensionLast=yes",
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
spawnSync("sudo", ["apt-get", "-y", "build-dep", "emacs"]);

if (!fs.existsSync(`emacs-${v}`)) {
  spawnSync("wget", ["-c", `http://ftpmirror.gnu.org/emacs/emacs-${v}.tar.gz`]);
  await cmd("tar", "xf", `emacs-${v}.tar.gz`);
}

console.log("Current directory content:");
fs.readdirSync(".");

if (["23.2b", "21.4a"].indexOf(v) != -1) {
  process.chdir(`emacs-${v.slice(0, -1)}`);
} else {
  process.chdir(`emacs-${v}`);
}

await build(v);
await cmd("sudo", "make", "install");
process.chdir(`..`);
