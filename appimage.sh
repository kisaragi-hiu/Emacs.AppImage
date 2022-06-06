#!/bin/bash

########################################################################
# Package the binaries built on Travis-CI as an AppImage
# By Simon Peter 2016
# For more information, see http://appimage.org/
########################################################################

export ARCH=$(arch)

APP=Emacs
LOWERAPP=${APP,,}

GIT_REV=$(git rev-parse --short HEAD)
echo $GIT_REV

mkdir -p build/$APP/$APP.AppDir/usr/

cd build/$APP/

# wget -q https://github.com/probonopd/AppImages/raw/master/functions.sh -O ./functions.sh
. ./package/functions.sh

cd $APP.AppDir

sudo chown -R $USER /app/
BINARY=$(find /app/bin/ -name emacs* -type f -executable | head -n 1)
sed -i -e 's|/app|././|g' $BINARY

cp -r /app/* ./usr/
BINARY=$(find ./usr/bin/ -name emacs* -type f -executable | head -n 1)

########################################################################
# Copy desktop and icon file to AppDir for AppRun to pick them up
########################################################################

cp ~/AppRun .
chmod a+x ./AppRun
get_desktop
get_icon

########################################################################
# Copy in the dependencies that cannot be assumed to be available
# on all target systems
########################################################################

copy_deps

########################################################################
# Delete stuff that should not go into the AppImage
########################################################################

# Delete dangerous libraries; see
# https://github.com/probonopd/AppImages/blob/master/excludelist
delete_blacklisted

rm -rf app/ || true

########################################################################
# Determine the version of the app; also include needed glibc version
########################################################################

GLIBC_NEEDED=$(glibc_needed)
VERSION="$1"

########################################################################
# Patch away absolute paths; it would be nice if they were relative
########################################################################

sed -i -e 's|/usr|././|g' $BINARY
sed -i -e 's|/app|././|g' $BINARY

########################################################################
# Other Emacs-specific finishing touches
########################################################################

(
	cd usr/bin/
	rm emacs
	ln -s emacs-* emacs
)

# mv etc/ e
# sed -i -e 's|/etc|../e|g' $BINARY
# sed -i -e 's|/etc|../e|g' ./usr/share/emacs/site-lisp/debian-startup.el
# sed -i -e 's|/usr|././|g' ./usr/share/emacs/site-lisp/debian-startup.el
# sed -i -e 's|/app|././|g' ./usr/share/emacs/site-lisp/debian-startup.el

########################################################################
# AppDir complete
# Now packaging it as an AppImage
########################################################################

cd .. # Go out of AppDir

mkdir -p ../out/
generate_type2_appimage

readlink -f ../out/*.AppImage*
