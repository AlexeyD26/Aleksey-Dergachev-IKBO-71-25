#!/bin/sh
cd "$(dirname "$0")/.." || exit 1

python3 src/main.py --config examples/broken.xml </dev/null
python3 src/main.py --config examples/missing.xml </dev/null
python3 src/main.py --vfs demo.json \
    --script examples/missing.txt </dev/null
python3 src/main.py --config config.xml \
    --vfs other.json --script examples/start.txt </dev/null
