#!/usr/bin/env bash
set -euo pipefail

docker compose up -d --build

for attempt in $(seq 1 30); do
  if curl --fail --silent http://localhost:8000/api/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "API não ficou saudável a tempo" >&2
    exit 1
  fi
  sleep 1
done

smoke_dir=$(mktemp -d -t enter-backend-smoke.XXXXXX)
trap 'rm -rf "$smoke_dir"' EXIT

curl --fail --silent http://localhost:8000/api/cases >"$smoke_dir/cases-before.json"
python - "$smoke_dir/cases-before.json" "$smoke_dir/ids-before.txt" "$smoke_dir/document.txt" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)
assert payload["total"] == 2, payload
ids = sorted(item["id"] for item in payload["items"])
with open(sys.argv[2], "w", encoding="utf-8") as target:
    target.write("\n".join(ids))
demo = next(item for item in payload["items"] if item["is_demo"])
assert demo["status"] == "ENCERRADO"
with open(sys.argv[3], "w", encoding="utf-8") as target:
    target.write(demo["id"])
PY

demo_id=$(sed -n '1p' "$smoke_dir/document.txt")
curl --fail --silent "http://localhost:8000/api/cases/$demo_id/workspace" >"$smoke_dir/workspace.json"
document_id=$(python - "$smoke_dir/workspace.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)
print(payload["documents"][0]["id"])
PY
)
curl --fail --silent "http://localhost:8000/api/documents/$document_id/file" >"$smoke_dir/document.pdf"
head -c 5 "$smoke_dir/document.pdf" | grep --quiet '%PDF-'

docker compose restart api
for attempt in $(seq 1 30); do
  if curl --fail --silent http://localhost:8000/api/health >/dev/null; then
    break
  fi
  sleep 1
done

curl --fail --silent http://localhost:8000/api/cases >"$smoke_dir/cases-after.json"
python - "$smoke_dir/cases-after.json" "$smoke_dir/ids-before.txt" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)
with open(sys.argv[2], encoding="utf-8") as source:
    before = source.read().splitlines()
after = sorted(item["id"] for item in payload["items"])
assert before == after, (before, after)
PY

echo "Smoke test concluído: health, seeds, PDF e persistência após restart estão OK."
