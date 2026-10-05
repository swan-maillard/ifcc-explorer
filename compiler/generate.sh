#!/usr/bin/env bash
# Rebuilds the original compiler in Docker and regenerates data/raw and src/data/programs.json.
# IFCC_SRC can point to a local copy of the original repo, otherwise it's cloned into .cache.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
src="${IFCC_SRC:-$repo/.cache/INSA-4A-CompilerC}"
if [ ! -d "$src" ]; then
    git clone -q -c core.autocrlf=false https://github.com/swan-maillard/INSA-4A-CompilerC "$src"
    git -C "$src" checkout -q 3e801a9
fi

# Docker Desktop on Windows wants C:/... paths, Git Bash gives /c/...
hostpath() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }

docker build -q -t ifcc-explorer-build "$repo/compiler" > /dev/null
MSYS_NO_PATHCONV=1 docker run --rm \
    -v "$(hostpath "$repo"):/repo" \
    -v "$(hostpath "$src"):/src:ro" \
    ifcc-explorer-build bash /repo/compiler/in-docker.sh
