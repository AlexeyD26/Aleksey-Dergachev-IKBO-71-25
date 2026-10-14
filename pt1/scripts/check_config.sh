#!/bin/sh
set -e
cd "$(dirname "$0")/.." || exit 1

python3 src/main.py --vfs demo.json \
    --script examples/start.txt </dev/null
python3 src/main.py --config config.xml </dev/null
python3 src/main.py --config config.xml \
    --vfs other.json </dev/null
python3 src/main.py --config config.xml \
    --script examples/interactive.txt </dev/null
python3 src/main.py --config config.xml \
    --vfs other.json --script examples/interactive.txt </dev/null
