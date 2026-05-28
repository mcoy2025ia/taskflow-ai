"""Restaura la descripcion del Dashboard Streamlit que fue sobreescrita por error."""
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
BASE_HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

USERS_PROJECTS = [
    "9834c505-6bbc-4914-96f6-5cfa6eb89c4f",
    "1e6538cb-c25b-4039-8bcd-9d7a5383c760",
    "7c7145d3-6fe5-4daf-95e9-57096674c56c",
    "9dc2eaa0-07c4-4f51-b6bb-ea1a11365581",
]

CORRECT_DESC = (
    "Conectar el chat con el sistema RAG de productos. Panel lateral de "
    "prediccion rapida: input order_id -> salida delay/cancellation. "
    "Complejidad: Baja — Estimado: 1 dia."
)

EXACT_TITLE = "Dashboard Streamlit: integraci"   # parte del titulo real

def fix_user(user_id: str) -> int:
    enc = urllib.parse.quote(f"%{EXACT_TITLE}%")
    url = f"{SUPABASE_URL}/rest/v1/tasks?title=ilike.{enc}&user_id=eq.{user_id}&status=eq.done"
    payload = json.dumps({"description": CORRECT_DESC}).encode()
    req = urllib.request.Request(url, data=payload, headers=BASE_HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read())
            return len(rows)
    except urllib.error.HTTPError as e:
        print(f"  ERROR {user_id[:8]}: {e.read().decode()[:200]}")
        return 0

def main():
    print("Restaurando descripcion de Dashboard Streamlit: integracion chat RAG...")
    total = 0
    for uid in USERS_PROJECTS:
        n = fix_user(uid)
        print(f"  {uid[:8]}... -> {n} restaurada(s)")
        total += n
    print(f"\nTotal restaurado: {total} tareas")

if __name__ == "__main__":
    main()
