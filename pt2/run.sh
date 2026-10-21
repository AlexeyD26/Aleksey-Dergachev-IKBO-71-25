#!/bin/sh
set -eu
cd "$(dirname "$0")"
node src/index.js "$@"
