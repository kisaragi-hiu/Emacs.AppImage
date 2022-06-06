import process from "process";
import { spawnSync } from "child_process";
import { VersionLessThan } from "./version";

function cmd(command) {
  return spawnSync(command[0], command.slice(1));
}

function print_help() {
  console.log(`
install-emacs.js <version>

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

function build(version) {
  spawnSync("autogen.sh");
  if (VersionLessThanOrEqual("24", version)) {
    extra_args = [...extra_args, "--without-selinux"];
  }
  if (VersionLessThanOrEqual("25", version)) {
    extra_args = [...extra_args, "--with-modules"];
  }
  if (VersionLessThanOrEqual("27", version)) {
    cmd("sudo", "apt-get", "-y", "libjansson4");
    extra_args = [...extra_args, "--with-cairo", "--with-harfbuzz"];
  }
  if (VersionLessThanOrEqual("28", version)) {
    extra_args = [...extra_args, "--with-with-native-compilation"];
    make_args = ["NATIVE_FULL_AOT=1", "bootstrap"];
  }
  spawnSync("configure", [...all_args, ...extra_args]);
  spawnSync("make", make_args);
}

cmd("sudo", "apt-get", "-y", "build-dep", "emacs-gtk");

cmd("wget", "-c", `http://ftpmirror.gnu.org/emacs/emacs-${version}.tar.gz`);
cmd("tar", "xf", `emacs-${version}.tar.gz`);
process.chdir(`emacs-${version}`);
build(version);
cmd("sudo", "make", "install");
process.chdir(`..`);
fs.copyFileSync("AppRun", path.join(os.homedir(), "AppRun"));

// This should put the finished AppImage in ./build/Emacs/out/
cmd("bash", "-ex", "appimage.sh", version);
