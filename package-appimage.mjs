import process from "node:process";
import path from "node:path";
import {
  // VersionLessThanOrEqual,
  // VersionLessThan,
  VersionBetween,
} from "./version.mjs";
import { cmd } from "./cmd.mjs";

let v = process.argv[2];
if (!v) {
  process.exit(1);
}
let APP = "Emacs";

let excludelist = "";
if (VersionBetween("25", v, "26")) {
  excludelist = "package/excludelist_25";
} else if (VersionBetween("26", v, "29")) {
  excludelist = "package/excludelist_26_27_28";
} else {
  excludelist = "package/excludelist_empty";
}
excludelist = path.resolve(excludelist);

let AppRun = path.resolve("AppRun");

await cmd(
  "bash",
  "-ex",
  "-c",
  `
# Metadata
export ARCH=$(uname -m)
APP=${APP}
LOWERAPP=${APP.toLowerCase()}
GIT_REV=$(git rev-parse --short HEAD)
echo $GIT_REV

# wget -q https://github.com/probonopd/AppImages/raw/master/functions.sh -O ./functions.sh
. ./package/functions.sh

# Set up AppDir
mkdir -p build/$APP/$APP.AppDir/usr/
cd build/$APP/
cd $APP.AppDir

sudo chown -R $USER /app/
BINARY=$(find /app/bin/ -name emacs* -type f -executable | head -n 1)
sed -i -e 's|/app|././|g' $BINARY

cp -r /app/* ./usr/
BINARY=$(find ./usr/bin/ -name emacs* -type f -executable | head -n 1)
sed -i -e 's|/usr|././|g' $BINARY
sed -i -e 's|/app|././|g' $BINARY

## Copy desktop and icon file to AppDir for AppRun to pick them up
cp ${AppRun} .
chmod a+x ./AppRun

### eg. emacs.desktop -> emacs-27.2.desktop + edit name "Emacs" to "Emacs 27.2"
for FILE in $(find usr/share/applications -iname "*$\{LOWERAPP}.desktop"); do
  sed 's/Name=Emacs/Name=Emacs ${v}/' "$FILE" > "$(basename "$FILE" .desktop)"-${v}.desktop
done
get_icon

## Copy dependencies then delete stuff that should not be bundled
copy_deps
delete_blacklisted ${excludelist}
rm -rf app/ || true
GLIBC_NEEDED=$(glibc_needed)
VERSION="${v}"

# mkdir -p ./lib/x86_64-linux-gnu/webkit2gtk-4.0
if [ -d "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.0" ]; then
  cp -r /usr/lib/x86_64-linux-gnu/webkit2gtk-4.0 ./lib/x86_64-linux-gnu/
fi

(
 cd usr/bin/
 rm emacs
 ln -s emacs-* emacs
)

# Package
cd .. # Go out of AppDir
mkdir -p ../out/
generate_type2_appimage
readlink -f ../out/*.AppImage*
`,
);
