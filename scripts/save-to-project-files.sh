#!/usr/bin/env bash
# Dev helper (cloud build only): mirror the source to the shared project folder.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/mnt/project-files/nutritrack-rpg"
mkdir -p "$DEST/"
cd "$SRC"
tar --exclude=./node_modules --exclude=./dist --exclude=./dev-dist --exclude=./test-results --exclude='*.tsbuildinfo' -cf - . | (cd "$DEST/" && tar -xf -)
echo "saved to $DEST/"
