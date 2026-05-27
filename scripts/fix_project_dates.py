"""
Corrige las fechas de los proyectos 'Pipeline Olist' en Supabase.
La simulacion cubre Mar 27, 2026 -> May 27, 2026 (2 meses exactos).
Los proyectos tenian fechas de 2025 (antiguo seed) que causaban
timePct=614% en el dashboard de analitica.
"""
import json, urllib.request, urllib.error
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
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# Los 4 proyectos Pipeline Olist (uno por usuario)
PROJECT_IDS = [
    "4a4947be-d219-4048-a3fc-838a94fe4283",  # mcoyllmdata
    "a900687c-a653-4c59-9196-2f910451e734",  # manuelalbertocoy
    "3dfff950-d4cc-4194-bf09-242dd4408d20",  # hotmail
    "4bad66eb-2b09-4645-a106-90abdce1629b",  # uandes
]

CORRECT_START    = "2026-03-27"
CORRECT_DELIVERY = "2026-05-27"

def get_project(pid: str) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/projects?id=eq.{pid}&select=id,name,start_date,delivery_date"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        rows = json.loads(r.read())
        return rows[0] if rows else {}

def patch_project(pid: str) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/projects?id=eq.{pid}"
    payload = json.dumps({
        "start_date":    CORRECT_START,
        "delivery_date": CORRECT_DELIVERY,
    }).encode()
    req = urllib.request.Request(url, data=payload, headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read())
            return rows[0] if rows else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR HTTP {e.code}: {body[:200]}")
        return {}

def main():
    print("Leyendo fechas actuales...")
    for pid in PROJECT_IDS:
        row = get_project(pid)
        if row:
            print(f"  {pid[:8]}... '{row.get('name')}': "
                  f"start={row.get('start_date')} | delivery={row.get('delivery_date')}")
        else:
            print(f"  {pid[:8]}... NOT FOUND")

    print(f"\nActualizando a {CORRECT_START} -> {CORRECT_DELIVERY}...")
    updated = 0
    for pid in PROJECT_IDS:
        row = patch_project(pid)
        if row:
            print(f"  OK {pid[:8]}... '{row.get('name')}': "
                  f"{row.get('start_date')} -> {row.get('delivery_date')}")
            updated += 1
        else:
            print(f"  SKIP {pid[:8]}... (sin datos devueltos)")

    print(f"\nProyectos actualizados: {updated}/{len(PROJECT_IDS)}")
    print("\nResultado esperado en el dashboard:")
    print("  Rango: 27 mar 2026 -> 27 may 2026")
    print("  Dias transcurridos: ~61 de 61")
    print("  Tiempo consumido: ~100%")
    print("  Velocidad actual: ~0.72 t/d (44 tareas / 61 dias)")
    print("  Dias restantes: 0 (proyecto en deadline)")

if __name__ == "__main__":
    main()
