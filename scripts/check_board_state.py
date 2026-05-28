"""Verifica el estado final del tablero para el usuario principal."""
import json, urllib.request, urllib.parse
from pathlib import Path

SUPABASE_URL = "https://oxygmdwxfjkecgycoumz.supabase.co"
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
for line in env_path.read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
}

USER_ID = "9834c505-6bbc-4914-96f6-5cfa6eb89c4f"

def query(params: str) -> list:
    url = f"{SUPABASE_URL}/rest/v1/tasks?{params}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def main():
    for status in ("done", "in_progress", "todo"):
        enc = urllib.parse.quote(status)
        rows = query(f"user_id=eq.{USER_ID}&status=eq.{enc}&select=title,priority,due_date&order=position.asc")
        print(f"\n=== {status.upper()} ({len(rows)}) ===")
        for r in rows:
            due = (r.get("due_date") or "")[:10]
            print(f"  [{r['priority'][:1].upper()}] {r['title'][:80]}  due={due}")

    # Buscar las que matchearon "integraci"
    rows = query(f"user_id=eq.{USER_ID}&title=ilike.%25integraci%25&select=title,status")
    print(f"\n=== Matches 'integraci' ({len(rows)}) ===")
    for r in rows:
        print(f"  [{r['status']}] {r['title']}")

if __name__ == "__main__":
    main()
