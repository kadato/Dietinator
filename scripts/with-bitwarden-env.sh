#!/usr/bin/env bash
# Run a command with YAZIO creds pulled from Bitwarden at runtime.
# No secret is written to disk. Requires: bw login and BW_SESSION set.
# Usage: BW_SESSION="$(bw unlock --raw)" ./scripts/with-bitwarden-env.sh npm run test:e2e:dev
set -euo pipefail

if ! command -v bw >/dev/null 2>&1; then
  echo "bw not found. Install with: brew install bitwarden-cli" >&2
  exit 1
fi

if [ -z "${BW_SESSION:-}" ]; then
  echo "BW_SESSION not set. Run: export BW_SESSION=\"\$(bw unlock --raw)\"" >&2
  exit 1
fi

export YAZIO_EMAIL
export YAZIO_PASSWORD
YAZIO_EMAIL="$(bw get username yazio-dietinator)"
YAZIO_PASSWORD="$(bw get password yazio-dietinator)"

if [ -z "$YAZIO_EMAIL" ] || [ -z "$YAZIO_PASSWORD" ]; then
  echo "Could not read yazio-dietinator from vault. Create a Login item named yazio-dietinator first." >&2
  exit 1
fi

exec "$@"
