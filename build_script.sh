#!/bin/zsh
set -euo pipefail

ZINT_DEV_FOLDER=$(readlink -f $(dirname $0))

echo "Zint DEV FOLDER : $ZINT_DEV_FOLDER"

yarn
cd internal_components/default

yarn
yarn build

cd $ZINT_DEV_FOLDER

mkdir -p extraResources/components
cp -r internal_components/default/dist extraResources/components/default

yarn package:applesilicon

cd .webpack

mv ./arm64/* ./
rm -rf ./arm64

cd $ZINT_DEV_FOLDER

if [[ "$1" == "--publish" ]]; then
  yarn fullbuilderpublish:applesilicon
elif [[ "$1" == "--no-publish" ]]; then
  yarn fullbuilder:applesilicon
fi