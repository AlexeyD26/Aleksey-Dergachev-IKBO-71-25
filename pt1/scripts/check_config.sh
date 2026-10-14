#!/bin/sh
set -e
cd "$(dirname "$0")/.." || exit 1

python3 src/main.py --vfs examples/vfs/minimal.json \
    --script examples/start.txt </dev/null
python3 src/main.py --config config.xml </dev/null
python3 src/main.py --config config.xml \
    --vfs examples/vfs/files.json </dev/null
python3 src/main.py --config config.xml \
    --script examples/interactive.txt </dev/null
python3 src/main.py --config config.xml \
    --vfs examples/vfs/deep.json \
    --script examples/interactive.txt </dev/null
