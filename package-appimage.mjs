import process from "node:process";
import path from "node:path";
import {
  // VersionLessThanOrEqual,
  // VersionLessThan,
  VersionBetween,
} from "./version.mjs";
import { cmd } from "./helpers.mjs";

let v = process.argv[2];
if (!v) {
  process.exit(1);
}
let APP = "Emacs";

let excludelist = "";
if (VersionBetween("25", v, "26")) {
  excludelist = "package/excludelist_25";
} else if (VersionBetween("26", v, "30")) {
  excludelist = "package/excludelist_26-29";
} else {
  excludelist = "package/excludelist_empty";
}
excludelist = path.resolve(excludelist);

let AppRun = path.resolve("package/AppRun");
let SiteStart = path.resolve("package/site-start.el");

// Based on https://github.com/probonopd/Emacs.AppImage/blob/master/appimage.sh
await cmd(
  "bash",
  "-e",
  "-c",
  `
# Metadata
export ARCH=$(uname -m)
APP=${APP}
LOWERAPP=${APP.toLowerCase()}
GIT_REV=$(git rev-parse --short HEAD)
echo $GIT_REV

echo "Downloading appimagetool..."
wget -q https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage -O appimagetool
chmod a+x appimagetool
appimagetool=$(readlink -f appimagetool)
echo "Downloading appimagetool...done"

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

# Still in AppDir

## Copy desktop and icon file to AppDir for AppRun to pick them up
cp ${AppRun} . # that's a JS variable! Same below.
chmod a+x ./AppRun

cp ${SiteStart} ./usr/share/emacs/site-lisp/site-start.el

# Emacs can find the dump next to the executable with the same basename.
#
# This is... not the best approach. We're still unnecessarily setting
# libexecdir during build. But this should at least get the dump to
# load.
emacs_exe=$(find ./usr/bin/ -name "emacs*" -type f -executable -not -name "*client" | head -n 1)
dump=$(find usr/lib/ -name "*.pdmp")
if [ -f "$dump" ]; then
  mv "$dump" "$emacs_exe".pdmp
fi

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
 ln -s $(find . -name "emacs-*" -executable) emacs
)

# Package
cd .. # Go out of AppDir. We're in build/ right now
mkdir -p ../out/
UPINFO="gh-releases-zsync|kisaragi-hiu|Emacs.AppImage|latest|Emacs-*x86_64.AppImage.zsync"
"$appimagetool" -u "$UPINFO" -v $APP.AppDir
mv *.AppImage* ../out/ # this includes the zsync file

# readlink prints "the value of a symbolic link or canonical file
# name". I added this because I could never remember what "readlink"
# is doing here.
readlink -f ../out/*.AppImage*
`,
);
