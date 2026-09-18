#!/bin/sh
# Regenerates every sound in assets/sounds from the synth scripts (macOS: uses the built-in afconvert).
# AAC-LC at 64 kbps: plays everywhere (iOS, Android, web) at roughly half the size of the default encode,
# with no audible loss on these noise-based, synthesized sounds.
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

python3 scripts/gen-garden-ambience.py "$tmp/garden-ambience.wav"
python3 scripts/gen-sfx.py "$tmp"

for wav in "$tmp"/*.wav; do
  afconvert -f m4af -d aac -b 64000 -s 1 "$wav" "assets/sounds/$(basename "${wav%.wav}").m4a"
done
ls -l assets/sounds
