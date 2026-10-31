#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
comparison_dir=$(mktemp -d)
trap 'rm -rf "$comparison_dir"' EXIT
cargo_bin="${CARGO_BIN:-cargo}"

for spec in adler2:2.0.1 cfg-if:1.0.4 tinyvec_macros:0.1.1; do
  package=${spec%:*}
  version=${spec#*:}
  for mode in default enabled; do
    if [ "$package" = tinyvec_macros ] && [ "$mode" = enabled ]; then
      continue
    fi
    case_dir="$comparison_dir/$package-$mode"
    mkdir -p "$case_dir"
    features='[]'
    if [ "$mode" = enabled ]; then
      features='["rustc-dep-of-std"]'
    fi
    cat > "$case_dir/Cargo.toml" <<EOF
[package]
name = "dependency-comparison"
version = "0.1.0"
edition = "2021"
[lib]
path = "lib.rs"
[dependencies]
$package = { version = "=$version", features = $features }
EOF
    : > "$case_dir/lib.rs"
    "$cargo_bin" tree --manifest-path "$case_dir/Cargo.toml" \
      -p "$package@$version" --target all --edges normal,build,dev \
      --charset ascii > "examples/cargo-$package-$mode.txt"
  done
done
