import process from "node:process";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  VersionLessThanOrEqual,
  VersionEqual,
  VersionLessThan,
  VersionBetween,
} from "./version.mjs";
import { cmd, log } from "./helpers.mjs";

function print_help() {
  console.log(`
node build-emacs.mjs <version>

<version>: Something like 28.1, 27.2, 26.3...
See http://ftpmirror.gnu.org/emacs/ for a list of all versions.
`);
}

/**
 * Download Emacs tarball for `version` from ftpmirror.gnu.org.
 * If the file already exists, just return as if it's just been downloaded.
 *
 * This tries xz, bz2, and gz tarballs, in that order.
 * (xz archives started being provided from 24.2 onwards; bz2 between
 * 23.1 and 24.2 (inclusive); gz for all versions.)
 *
 * Returns the downloaded file name, or null if the download process
 * returned a non-zero exit code.
 *
 * @param {string} version
 */
function downloadEmacs(version) {
  for (const ext in ["xz", "bz2", "gz"]) {
    const file = `emacs-${version}.tar.${ext}`;
    if (fs.existsSync(file)) {
      log("Emacs tarball is already present");
      return file;
    } else {
      const res = spawnSync("wget", [`http://ftpmirror.gnu.org/emacs/${file}`]);
      if (res.status === 0) {
        return file;
      }
    }
  }
  return null;
}

// Ported from https://github.com/purcell/nix-emacs-ci/blob/master/emacs.nix

/** Return the patch files applicable for `version`, relative to the
 * project root directory. */
function patches(version) {
  let files = [];
  if (VersionEqual("23.4", version)) {
    files.push("all-dso-handle.patch", "fpending-23.4.patch");
  }
  if (VersionEqual("24.1", version)) {
    files.push(
      "gnutls-e_again-old-emacsen.patch",
      "all-dso-handle.patch",
      "remove-old-gets-warning.patch",
      "fpending-24.1.patch",
    );
  }
  if (VersionEqual("24.2", version)) {
    files.push(
      "gnutls-e_again-old-emacsen.patch",
      "all-dso-handle.patch",
      "fpending-24.1.patch",
    );
  }
  if (VersionEqual("24.3", version)) {
    files.push("all-dso-handle.patch", "fpending-24.3.patch");
  }
  if (VersionBetween("24.3", version, "26.3")) {
    files.push("gnutls-e_again.patch");
  }
  if (VersionBetween("25.1", version, "28.1")) {
    files.push("sigsegv-stack.patch");
  }
  // This allows me to specify patches from nix-emacs-ci without
  // repeating that path over and over again, while still being able
  // to add other patches.
  return files.map((file) => {
    if (file.includes("patches")) {
      return file;
    } else {
      return `./nix-emacs-ci/patches/${file}`;
    }
  });
}

/**
 * Return source directory name for `version`.
 * @param {string} version
 */
function dir_of(version) {
  // This is necessary because, for instance, emacs-23.2b.tar.gz
  // contains one folder called "emacs-23.2", and the two aren't the
  // same.
  if (["23.2b", "21.4a"].includes(version)) {
    return `emacs-${v.slice(0, -1)}`;
  } else {
    return `emacs-${v}`;
  }
}

async function build(version) {
  let extra_args = [];
  let make_args = [];
  let toolkit = "";
  let extra_packages = [];
  // // Disable the version of "movemail" provided by Emacs
  extra_args = ["--with-mailutils"];
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
  // Native compilation for 28+.
  // Disabled for now.
  // See https://github.com/kisaragi-hiu/Emacs.AppImage/issues/4
  if (VersionBetween("28", version, "29")) {
    // libgccjit needs to be the same version as gcc.
    // runner-images Ubuntu 20.04 provides gcc 9, so we use libgccjit-9.
    // extra_packages = [...extra_packages, "libgccjit-9-dev"];
    // extra_args = [...extra_args, "--with-native-compilation"];
    // make_args = ["NATIVE_FULL_AOT=1"];
  } else if (VersionLessThanOrEqual("29", version)) {
    // runner-images Ubuntu 22.04 provides gcc 11, so we use libgccjit-11.
    // Thank you reddit:u/martinslot for this comment:
    // https://reddit.com/r/emacs/comments/rojo7y/comment/hq188oe/
    // extra_packages = [...extra_packages, "libgccjit-11-dev"];
    // extra_args = [...extra_args, "--with-native-compilation=aot"];
  }

  // Emacs 29 adds native WebP support
  if (VersionLessThanOrEqual("29", version)) {
    extra_packages = [
      ...extra_packages,
      "libwebp-dev",
      "libsqlite3-dev",
      // This is added in Ubuntu 22.04, whereas other cases assume
      // Ubuntu 20.04. I've checked that other packages are all still
      // present in Ubuntu 22.04.
      "libtree-sitter-dev",
    ];
    extra_args = [...extra_args, "--with-sqlite3", "--with-tree-sitter"];
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
    "--libexecdir=/app/lib",
    `--with-x-toolkit=${toolkit}`,
    "--with-xft",
    ...extra_args,
  );
  await cmd("make", ...make_args);
}

let v = process.argv[2];

if (!v) {
  print_help();
  process.exit(1);
}

console.log("Adding deb-src entries for apt-get build-dep");
await cmd(
  "sudo",
  "sed",
  "-Ei",
  "/.*partner/! s/^# (deb-src .*)/\\1/g",
  "/etc/apt/sources.list",
);

spawnSync("sudo", ["apt-get", "update"]);
spawnSync("sudo", ["apt-get", "-y", "build-dep", "emacs"]);

log("Downloading Emacs tarball...");
const tarball = downloadEmacs(v);
if (typeof tarball !== "string") {
  log("Download failed");
  process.exit(1);
}
log("Downloading Emacs tarball...done");

console.log("Extracting Emacs tarball...");
if (!fs.existsSync(dir_of(v))) {
  await cmd("tar", "xf", tarball);
}
console.log("Extracting Emacs tarball...done");

console.log("Current directory content:");
fs.readdirSync(".");

console.log("Going into Emacs source directory");
process.chdir(dir_of(v));

// Patch application must be done with current directory in the source
// directory. Patches are sensitive to the current directory.
console.log("Applying patches");
for (const patch of patches(v)) {
  await cmd("patch", "-N", "--strip=1", `--input=../${patch}`);
}

console.log("Building");
await build(v);
await cmd("sudo", "make", "install");
process.chdir(`..`);
