#!/usr/bin/env bash
set -euo pipefail

api_url=${1:-${API_URL:-}}
if [ -z "$api_url" ]; then
  echo "Uso: ./scripts/smoke_deployed.sh https://api.example.com" >&2
  exit 2
fi
api_url=${api_url%/}

smoke_dir=$(mktemp -d -t enter-deployed-smoke.XXXXXX)
trap 'rm -rf "$smoke_dir"' EXIT

curl --fail --silent --show-error "$api_url/api/health" >"$smoke_dir/health.json"
curl --fail --silent --show-error "$api_url/api/cases" >"$smoke_dir/cases.json"

python3 - "$smoke_dir/health.json" "$smoke_dir/cases.json" "$smoke_dir/workspace-path.txt" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    health = json.load(source)
assert health == {"status": "ok", "database": "ok"}, health

with open(sys.argv[2], encoding="utf-8") as source:
    cases = json.load(source)
assert cases["total"] == 2, cases
demo = next(item for item in cases["items"] if item["is_demo"])
assert demo["status"] == "ENCERRADO", demo

with open(sys.argv[3], "w", encoding="utf-8") as target:
    target.write(f"/api/cases/{demo['id']}/workspace")
PY

workspace_path=$(sed -n '1p' "$smoke_dir/workspace-path.txt")
curl --fail --silent --show-error "$api_url$workspace_path" >"$smoke_dir/workspace.json"

document_id=$(python3 - "$smoke_dir/workspace.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    workspace = json.load(source)
print(workspace["documents"][0]["id"])
PY
)

curl --fail --silent --show-error \
  "$api_url/api/documents/$document_id/file" >"$smoke_dir/document.pdf"
head -c 5 "$smoke_dir/document.pdf" | grep --quiet '%PDF-'

echo "Deploy saudável: SQLite, seeds e download de PDF responderam corretamente."
