"""
Correcciones de coherencia cronologica al tablero Olist 93%.
Ejecutar una vez sobre la BD existente.

Cambios:
  1. "Deploy a Cloud Run" -> "(Entorno Staging)" en el titulo
  2. "Pruebas de integracion end-to-end" -> bug de zona horaria (edge case, no fallo total)
  3. "Documentacion tecnica final" -> mover de done a todo + nueva descripcion
  4. "Pruebas unitarias ETL" -> renombrar como RC / aseguramiento de calidad
  5. INSERT nueva tarea todo: "Release final a Produccion (Cloud Run & Airflow)"
"""

import json, urllib.request, urllib.error, urllib.parse
from pathlib import Path

# ── Credenciales ────────────────────────────────────────────────────────────
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
    ("9834c505-6bbc-4914-96f6-5cfa6eb89c4f", "4a4947be-d219-4048-a3fc-838a94fe4283"),
    ("1e6538cb-c25b-4039-8bcd-9d7a5383c760", "a900687c-a653-4c59-9196-2f910451e734"),
    ("7c7145d3-6fe5-4daf-95e9-57096674c56c", "3dfff950-d4cc-4194-bf09-242dd4408d20"),
    ("9dc2eaa0-07c4-4f51-b6bb-ea1a11365581", "4bad66eb-2b09-4645-a106-90abdce1629b"),
]

# ── Helpers ─────────────────────────────────────────────────────────────────
def patch_task(user_id: str, title_contains: str, payload: dict) -> int:
    """PATCH todas las tareas del usuario cuyo titulo contenga title_contains."""
    # ilike filter: case-insensitive substring
    enc = urllib.parse.quote(f"%{title_contains}%")
    url = f"{SUPABASE_URL}/rest/v1/tasks?title=ilike.{enc}&user_id=eq.{user_id}"
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=data, headers=BASE_HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read())
            return len(rows)
    except urllib.error.HTTPError as e:
        print(f"    ERROR PATCH '{title_contains}' ({user_id[:8]}): {e.read().decode()[:200]}")
        return 0


def insert_task(user_id: str, project_id: str, payload: dict) -> bool:
    url  = f"{SUPABASE_URL}/rest/v1/tasks"
    row  = {**payload, "user_id": user_id, "project_id": project_id}
    data = json.dumps(row).encode()
    req  = urllib.request.Request(url, data=data, headers=BASE_HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read())
            return len(rows) > 0
    except urllib.error.HTTPError as e:
        print(f"    ERROR INSERT ({user_id[:8]}): {e.read().decode()[:200]}")
        return False


# ════════════════════════════════════════════════════════════════════════════
# CAMBIO 1: Deploy a Cloud Run -> Entorno Staging
# ════════════════════════════════════════════════════════════════════════════
PATCH_CLOUD_RUN_TITLE = {
    "title": "Deploy a Cloud Run (Entorno Staging) con endpoint HTTPS autenticado",
}

# ════════════════════════════════════════════════════════════════════════════
# CAMBIO 2: Bug de integracion -> edge case zona horaria (pasó la demo igual)
# ════════════════════════════════════════════════════════════════════════════
PATCH_INTEGRATION_DESC = {
    "description": (
        "Escenario completo: ingestar CSV de prueba -> validar transformaciones "
        "Bronze/Silver/Gold -> llamar a /predict/delay con un pedido sintetico -> "
        "verificar respuesta. Detectar regresiones en el pipeline completo. "
        "Actualmente bloqueado en el stage Gold por un bug en el join de dim_date "
        "con las zonas horarias de la region Norte (NaT en transacciones cruzadas "
        "de medianoche). El bug no afecto la demo del cliente (datos estandar de "
        "Sao Paulo), pero falla al ejecutar el suite completo con datos multi-region. "
        "Complejidad: Media — Estimado: 3 dias."
    ),
}

# ════════════════════════════════════════════════════════════════════════════
# CAMBIO 3: Documentacion -> mover a TODO + nueva descripcion
# ════════════════════════════════════════════════════════════════════════════
PATCH_DOCS = {
    "status": "todo",
    "title":  "Actualizacion Documentacion tecnica final (MkDocs) post-pruebas de carga",
    "description": (
        "Actualizar MkDocs Material con los resultados finales de las pruebas de "
        "carga Locust: configuracion definitiva de escalado en Cloud Run (RAM, "
        "concurrency, min/max instancias), SLA validados (p95 < 500ms) y resolucion "
        "de los hallazgos de QA del dashboard. Tambien incluir guia de operacion "
        "para el equipo de produccion. Deploy en GitHub Pages. "
        "Depende de: pruebas de carga aprobadas + QA cerrado. "
        "Complejidad: Baja — Estimado: 1 dia."
    ),
    "position": 3000,
    "due_date": "2026-06-04T00:00:00.000Z",
}

# ════════════════════════════════════════════════════════════════════════════
# CAMBIO 4: Pruebas unitarias -> Aseguramiento de Calidad (Release Candidate)
# ════════════════════════════════════════════════════════════════════════════
PATCH_UNIT_TESTS = {
    "title": (
        "Aseguramiento de Calidad: Aumentar cobertura unitaria del pipeline ETL "
        "al 85% (Release Candidate)"
    ),
    "description": (
        "El pipeline ETL ya cuenta con tests unitarios base (61% de cobertura) "
        "escritos durante el desarrollo de cada stage. Para el Release Candidate "
        "se requiere alcanzar el 85%: agregar tests para los stages Silver y Gold, "
        "validar idempotencia en el DAG de Airflow y cubrir los casos borde de "
        "zona horaria que revelaron las pruebas de integracion. "
        "Framework: pytest + testcontainers (PostgreSQL efimero). "
        "Complejidad: Media — Estimado: 3 dias."
    ),
}

# ════════════════════════════════════════════════════════════════════════════
# NUEVA TAREA TODO: Release final a Produccion
# ════════════════════════════════════════════════════════════════════════════
NEW_RELEASE_PROD = {
    "title": "Release final a Produccion (Cloud Run & Airflow)",
    "description": (
        "Promover el entorno Staging a Produccion una vez aprobadas las pruebas "
        "de carga (Locust) y el QA del dashboard. Pasos: (1) Actualizar variables "
        "de entorno en Cloud Run (DB prod, secrets prod). (2) Activar el DAG de "
        "Airflow en el entorno de produccion. (3) Smoke test sobre endpoint prod. "
        "(4) Notificar al cliente con URL definitiva y credenciales. "
        "Depende de: Locust OK + QA OK + Documentacion actualizada. "
        "Complejidad: Media — Estimado: 2 dias."
    ),
    "status":   "todo",
    "priority": "high",
    "position": 4000,
    "due_date": "2026-06-06T00:00:00.000Z",
}


# ════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════
def main():
    total_patched = 0
    total_inserted = 0

    for idx, (user_id, project_id) in enumerate(USERS_PROJECTS):
        uid = user_id[:8]
        print(f"\n[{idx+1}/4] Usuario {uid}...")

        # --- Cambio 1: Cloud Run Staging ---
        n = patch_task(user_id, "Deploy a Cloud Run", PATCH_CLOUD_RUN_TITLE)
        print(f"  C1 Cloud Run -> Staging : {n} tarea(s) actualizada(s)")
        total_patched += n

        # --- Cambio 2: Bug -> edge case zona horaria ---
        n = patch_task(user_id, "integraci", PATCH_INTEGRATION_DESC)
        print(f"  C2 Bug -> edge case TZ  : {n} tarea(s) actualizada(s)")
        total_patched += n

        # --- Cambio 3: Documentacion -> TODO + nueva desc ---
        n = patch_task(user_id, "Documentaci", PATCH_DOCS)
        print(f"  C3 Docs -> TODO         : {n} tarea(s) actualizada(s)")
        total_patched += n

        # --- Cambio 4: Unit tests -> RC ---
        n = patch_task(user_id, "unitarias del pipeline ETL", PATCH_UNIT_TESTS)
        print(f"  C4 Unit tests -> RC     : {n} tarea(s) actualizada(s)")
        total_patched += n

        # --- Nueva tarea: Release final a Produccion ---
        ok = insert_task(user_id, project_id, NEW_RELEASE_PROD)
        print(f"  C5 INSERT Release Prod  : {'OK' if ok else 'FAIL'}")
        if ok:
            total_inserted += 1

    print(f"\n{'='*55}")
    print(f"  Tareas actualizadas : {total_patched}")
    print(f"  Tareas insertadas   : {total_inserted} (release prod x usuario)")
    print(f"  Nuevo estado TODO   : 3 tareas (Locust + QA + Release Prod)")
    print(f"  Nuevo estado TODO   : + Documentacion (movida de done)")
    print(f"  Avance coherente    : ~91% SP done, restante = testing + release")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
