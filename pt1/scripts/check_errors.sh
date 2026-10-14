#!/bin/sh
cd "$(dirname "$0")/.." || exit 1

python3 src/main.py --config examples/broken.xml </dev/null
python3 src/main.py --config examples/missing.xml </dev/null
python3 src/main.py --vfs examples/vfs/files.json \
    --script examples/missing.txt </dev/null
python3 src/main.py --vfs examples/vfs/missing.json </dev/null
for task_vfs in minimal files deep; do
    python3 src/main.py --config config.xml \
        --vfs "examples/vfs/$task_vfs.json" \
        --script examples/start.txt </dev/null
done
