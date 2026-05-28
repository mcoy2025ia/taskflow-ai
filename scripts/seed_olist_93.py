"""
Seed realista: Pipeline Olist al 93% de avance.
Timeline: 27 mar 2026 → 27 may 2026 (2 meses)
Pesos: 1 SP=1d | 2 SP=2d | 3 SP=3d | 5 SP=1sem | 8 SP=complejo multisemana
Total: 145 SP → done=135 SP → 93.1%
"""

import json, urllib.request, urllib.error, sys
from pathlib import Path

# ── Credenciales ───────────────────────────────────────────────────────────────
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
    "Prefer":        "return=representation",
}

USERS_PROJECTS = [
    ("9834c505-6bbc-4914-96f6-5cfa6eb89c4f", "4a4947be-d219-4048-a3fc-838a94fe4283"),
    ("1e6538cb-c25b-4039-8bcd-9d7a5383c760", "a900687c-a653-4c59-9196-2f910451e734"),
    ("7c7145d3-6fe5-4daf-95e9-57096674c56c", "3dfff950-d4cc-4194-bf09-242dd4408d20"),
    ("9dc2eaa0-07c4-4f51-b6bb-ea1a11365581", "4bad66eb-2b09-4645-a106-90abdce1629b"),
]

# ════════════════════════════════════════════════════════════════════════════════
# TAREAS COMPLETADAS — 45 tareas | 135 SP | done=93.1%
# Fase 1 → Fase 11, ordenadas cronológicamente
# ════════════════════════════════════════════════════════════════════════════════
DONE = [

    # ── FASE 1: Infraestructura (sem 1 · 27 mar – 3 abr) ── 8 SP ─────────────
    {
        "title": "Setup del entorno de desarrollo y repositorio Git",
        "description": (
            "Crear repositorio, estructura de carpetas (data/raw, data/processed, "
            "src/pipelines, src/models, notebooks, tests, docs). Configurar .gitignore, "
            "pre-commit hooks y convenciones de ramas. "
            "Complejidad: Baja — Estimado: 1 día."
        ),
        "priority": "low", "position": 1000, "due_date": "2026-04-01T00:00:00.000Z",
    },
    {
        "title": "Provisionar PostgreSQL y definir esquemas Bronze / Silver / Gold",
        "description": (
            "Levantar instancia PostgreSQL 15. Crear esquemas bronze (raw), silver "
            "(transformado) y gold (agregado). Roles y permisos por capa. Scripts DDL "
            "versionados. Conexión desde notebooks verificada. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 2000, "due_date": "2026-04-02T00:00:00.000Z",
    },
    {
        "title": "Configurar MLflow Tracking Server y DVC para versionado",
        "description": (
            "MLflow con backend PostgreSQL y artifact store en S3. DVC init con remote S3. "
            "Primer dvc.yaml con stages vacíos. Verificar round-trip: log run → ver en UI. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 3000, "due_date": "2026-04-03T00:00:00.000Z",
    },
    {
        "title": "Setup CI/CD básico con GitHub Actions",
        "description": (
            "Workflow de lint (flake8, black), type-check (mypy) y ejecución de tests "
            "unitarios en cada push. Caché de dependencias pip. Badge en README. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 4000, "due_date": "2026-04-03T00:00:00.000Z",
    },

    # ── FASE 2: Ingesta y exploración (sem 1-2 · 1 abr – 10 abr) ── 9 SP ─────
    {
        "title": "Descarga y validación de integridad del dataset Olist (9 CSV)",
        "description": (
            "Descargar desde Kaggle API los 9 CSV. Verificar row count vs. documentación, "
            "encodings (UTF-8), separadores y ausencia de corrupción. Script reproducible "
            "con checksums MD5. "
            "Complejidad: Baja — Estimado: 1 día."
        ),
        "priority": "medium", "position": 5000, "due_date": "2026-04-02T00:00:00.000Z",
    },
    {
        "title": "DQ Report: análisis de calidad de datos (nulos, outliers, duplicados)",
        "description": (
            "Calcular por columna: tasa de nulos, distribución, outliers (IQR), duplicados "
            "exactos y parciales. pandas-profiling + informe HTML. Criterio de aceptación: "
            "menos del 5% de nulos en campos críticos (order_id, customer_id, timestamps). "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 6000, "due_date": "2026-04-07T00:00:00.000Z",
    },
    {
        "title": "EDA inicial: distribuciones, correlaciones y estadísticas descriptivas",
        "description": (
            "Análisis de distribuciones univariadas y bivariadas. Matriz de correlación. "
            "Histogramas de review_score, freight_value, price, payment_value. "
            "Identificar skewness y posibles transformaciones logarítmicas. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 7000, "due_date": "2026-04-08T00:00:00.000Z",
    },
    {
        "title": "EDA avanzado: ventas por estado, categoría y temporalidad",
        "description": (
            "Análisis geoespacial de GMV por estado (SP=42%). Top 20 categorías por "
            "volumen y ticket promedio. Estacionalidad mensual 2016-2018. Detección de "
            "picos: Black Friday 2017 (+320%). Visualizaciones Seaborn exportadas. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 8000, "due_date": "2026-04-10T00:00:00.000Z",
    },

    # ── FASE 3: Pipeline ETL (sem 2-4 · 8 abr – 18 abr) ── 19 SP ────────────
    {
        "title": "ETL Bronze: ingesta cruda de 9 CSV hacia PostgreSQL",
        "description": (
            "Cargar los CSV sin transformar al esquema bronze. pandas + SQLAlchemy "
            "con carga incremental (upsert por PK). Registrar: filas procesadas, "
            "tiempo de carga, errores por archivo en MLflow. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 9000, "due_date": "2026-04-11T00:00:00.000Z",
    },
    {
        "title": "Limpieza Bronze: tratamiento de nulos, duplicados y coerción de tipos",
        "description": (
            "Imputación de nulos con estrategia documentada (mediana, forward-fill o "
            "descarte según columna). Eliminación de duplicados con criterio de negocio. "
            "Coerción de fechas a datetime64[UTC]. Strip y lowercase en texto. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 10000, "due_date": "2026-04-14T00:00:00.000Z",
    },
    {
        "title": "Modelado del esquema estrella DW: fact_orders + 5 dimensiones",
        "description": (
            "Diseño dimensional: fact_orders (granularidad order_item) con dim_customer, "
            "dim_product, dim_seller, dim_date, dim_geo. Normalización 3FN en dims y "
            "desnormalización controlada en facts. Diagrama ER en draw.io. Scripts DDL. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 11000, "due_date": "2026-04-15T00:00:00.000Z",
    },
    {
        "title": "ETL Silver: fact_orders con columnas derivadas (delivery_days, is_late, review_delay)",
        "description": (
            "Join de 5 tablas. Cálculo de delivery_days (purchase → delivered), "
            "is_late (delivered > estimated), review_delay (review - delivered). "
            "Manejo de NaT en fechas faltantes. Partición por mes en PostgreSQL. "
            "Test de rowcount vs. source. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 12000, "due_date": "2026-04-18T00:00:00.000Z",
    },
    {
        "title": "ETL Silver: normalización de clientes, vendedores y geolocalización Haversine",
        "description": (
            "Deduplicar clientes por customer_unique_id. Vincular vendedores con CEP. "
            "Calcular distancia vendedor-comprador en km con fórmula de Haversine. "
            "Asignar región geográfica (N/NE/CO/SE/S). Índice espacial GiST. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 13000, "due_date": "2026-04-17T00:00:00.000Z",
    },

    # ── FASE 4: Analytics y KPIs (sem 3 · 16 abr – 23 abr) ── 9 SP ──────────
    {
        "title": "Cálculo y almacenamiento de KPIs: GMV, ticket promedio, churn, LTV",
        "description": (
            "Definir y calcular: GMV mensual, ticket promedio, tasa de recompra (6.4%), "
            "tasa de cancelación (2.1%), LTV estimado a 12 meses por cohorte. "
            "Almacenar en tabla gold.kpi_summary particionada por mes. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "high", "position": 14000, "due_date": "2026-04-18T00:00:00.000Z",
    },
    {
        "title": "Segmentación RFM de clientes con K-Means k=5",
        "description": (
            "Calcular Recency, Frequency, Monetary por customer_unique_id. "
            "Normalización MinMax. K-Means con k=5 (silhouette=0.62). "
            "Etiquetar segmentos: Champions, Loyalists, At-Risk, Lost, New. "
            "Análisis de valor por segmento y recomendaciones de acción. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 15000, "due_date": "2026-04-23T00:00:00.000Z",
    },
    {
        "title": "Clustering DBSCAN de vendedores por volumen, GMV y rating",
        "description": (
            "DBSCAN (eps=0.3, min_samples=5) sobre features normalizadas de vendedores. "
            "Identificar clusters: élite (alto volumen + rating), problemáticos "
            "(bajo rating), nicho (alto margen). Perfil de cada cluster. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 16000, "due_date": "2026-04-22T00:00:00.000Z",
    },
    {
        "title": "Análisis de cohortes de clientes 2016-2018 (retención mensual)",
        "description": (
            "Cohort por mes de primera compra. Calcular retention rate a 1, 3, 6 y "
            "12 meses. Heatmap de retención. Comparar cohorts por estado y categoría. "
            "Hallazgo clave: retención mes-1 = 3.2%, cae a 1.1% en mes-3. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 17000, "due_date": "2026-04-23T00:00:00.000Z",
    },

    # ── FASE 5: Feature Engineering (sem 4 · 19 abr – 26 abr) ── 9 SP ────────
    {
        "title": "Feature engineering: 15 variables temporales y estacionales",
        "description": (
            "Extraer: día_semana, mes, trimestre, semana_año, días_hasta_blackfriday, "
            "días_hasta_navidad. Flags: is_weekend, is_holiday_br (feriados nacionales). "
            "Ciclical encoding (sin/cos) para variables periódicas. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 18000, "due_date": "2026-04-21T00:00:00.000Z",
    },
    {
        "title": "Feature engineering: variables geográficas y densidad logística",
        "description": (
            "Región BR (N/NE/CO/SE/S), densidad logística por estado (pedidos/km²), "
            "distancia_haversine, mismo_estado (vendedor-comprador), "
            "promedio_demora_histórica por ruta (estado_origen → estado_destino). "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 19000, "due_date": "2026-04-23T00:00:00.000Z",
    },
    {
        "title": "Feature engineering avanzado: lag features y rolling statistics",
        "description": (
            "Lag features del vendedor: volumen_7d, volumen_30d, tasa_demora_30d, "
            "rating_promedio_30d. Rolling mean y std de precios por categoría. "
            "Requirió refactorizar el pipeline ETL para preservar orden temporal. "
            "La tarea más compleja de esta fase. "
            "Complejidad: Alta — Estimado: 3 días."
        ),
        "priority": "high", "position": 20000, "due_date": "2026-04-26T00:00:00.000Z",
    },
    {
        "title": "Encoding y normalización del dataset final para modelos ML",
        "description": (
            "Target encoding para categorías de alta cardinalidad (product_category). "
            "Label encoding para variables ordinales. StandardScaler en features numéricas. "
            "Split temporal train/val/test (2016-2017 / 2018-Q1 / 2018-Q2). "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 21000, "due_date": "2026-04-25T00:00:00.000Z",
    },

    # ── FASE 6: Modelos ML (sem 4-6 · 24 abr – 7 may) ── 23 SP ──────────────
    {
        "title": "Entrenamiento XGBoost: predicción de días de demora",
        "description": (
            "Modelo de regresión con 52 features. Baseline: RMSE=4.1d (media histórica). "
            "XGBoost: n_estimators=500, max_depth=6, lr=0.05, subsample=0.8. "
            "Resultado: RMSE=2.3d en test. Early stopping en 50 rondas. "
            "La tarea más crítica del proyecto por su impacto en producción. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 22000, "due_date": "2026-04-30T00:00:00.000Z",
    },
    {
        "title": "Evaluación XGBoost: métricas, curvas ROC y análisis de residuos",
        "description": (
            "RMSE=2.3d, MAE=1.6d, R²=0.74. Versión clasificación is_late: ROC-AUC=0.87. "
            "Feature importance top-20 (SHAP). Análisis de residuos segmentado por región "
            "y categoría. Error sistemático detectado en región Norte (+0.8d). "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "high", "position": 23000, "due_date": "2026-05-01T00:00:00.000Z",
    },
    {
        "title": "Optimización de hiperparámetros XGBoost con Optuna (100 trials)",
        "description": (
            "Búsqueda bayesiana: n_estimators (100-1000), max_depth (3-10), "
            "learning_rate (0.01-0.3), subsample (0.6-1.0), colsample_bytree (0.6-1.0). "
            "100 trials con pruning MedianPruner. Mejora: RMSE 2.3d → 2.1d. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 24000, "due_date": "2026-05-03T00:00:00.000Z",
    },
    {
        "title": "Modelo LightGBM: predicción de cancelación de pedidos (F1=0.83)",
        "description": (
            "Clasificación binaria (is_cancelled, 2.1% de positivos). SMOTE para "
            "balanceo de clases. LightGBM: F1=0.83, Precision=0.81, Recall=0.85. "
            "Threshold calibrado con Platt scaling. Análisis de falsos negativos "
            "por categoría (electrónicos tienen mayor tasa). "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 25000, "due_date": "2026-05-06T00:00:00.000Z",
    },
    {
        "title": "Análisis de sentimientos en reseñas con BERT-pt (F1-macro=0.79)",
        "description": (
            "Fine-tuning de neuralmind/bert-base-portuguese-cased para clasificación "
            "1-5 estrellas. Dataset: 100K reseñas. F1-macro=0.79 en test. "
            "Duración de entrenamiento: 6h en GPU T4. Embeddings CLS almacenados "
            "para búsqueda semántica. La tarea más compleja y larga del proyecto. "
            "Complejidad: Muy Alta — Estimado: 8 días."
        ),
        "priority": "high", "position": 26000, "due_date": "2026-05-07T00:00:00.000Z",
    },

    # ── FASE 7: Embeddings y RAG (sem 5-6 · 28 abr – 9 may) ── 10 SP ─────────
    {
        "title": "Pipeline de embeddings Voyage AI voyage-3-lite en batch (512 dims)",
        "description": (
            "Generar embeddings para 33K productos y 100K reseñas con voyage-3-lite. "
            "Batch processing: 21 req/s respetando rate limits. content_hash para "
            "evitar re-embedding innecesario. Almacenamiento en halfvec(512) pgvector. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 27000, "due_date": "2026-05-01T00:00:00.000Z",
    },
    {
        "title": "Sistema RAG sobre catálogo y descripciones de 33K productos Olist",
        "description": (
            "Indexar título, descripción y categoría de todos los productos. "
            "Búsqueda híbrida: intent detection (regex) + vector search. "
            "Top-20 candidatos → reranking rerank-2-lite → top-5 al LLM. "
            "Integrado en chat del dashboard. MRR@5=0.71 en queries de prueba. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 28000, "due_date": "2026-05-08T00:00:00.000Z",
    },
    {
        "title": "Índice HNSW pgvector + reranking rerank-2-lite integrado",
        "description": (
            "Índice HNSW (m=16, ef_construction=64) con halfvec_cosine_ops. "
            "Latencia p95 de búsqueda vectorial: 12ms. Reranking con Voyage "
            "rerank-2-lite: mejora MRR@5 de 0.63 → 0.71. Fallback sin rerank "
            "implementado para resiliencia. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 29000, "due_date": "2026-05-09T00:00:00.000Z",
    },

    # ── FASE 8: Dashboard Streamlit (sem 6-7 · 5 may – 17 may) ── 17 SP ──────
    {
        "title": "Dashboard Streamlit: módulo KPIs y resumen ejecutivo",
        "description": (
            "Página principal: GMV acumulado, ticket promedio, tasa de churn, "
            "LTV por segmento. Cards con delta vs. mes anterior. Gráfico de "
            "líneas GMV diario con banda de confianza. Sidebar con filtros "
            "de fecha y categoría. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 30000, "due_date": "2026-05-08T00:00:00.000Z",
    },
    {
        "title": "Dashboard Streamlit: mapa coroplético de ventas por estado BR",
        "description": (
            "Mapa interactivo con Plotly Choropleth: GMV, volumen y review_score "
            "por estado. Tooltips con top-3 productos. Filtros: período, categoría, "
            "segmento. Exportar vista actual a PNG. Requirió GeoJSON de estados BR. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 31000, "due_date": "2026-05-11T00:00:00.000Z",
    },
    {
        "title": "Dashboard Streamlit: análisis NLP de reseñas con búsqueda semántica",
        "description": (
            "Nube de palabras por rating (1-5 estrellas). Distribución de sentimientos "
            "por categoría y estado. Barra de búsqueda semántica sobre reseñas "
            "(Voyage AI + pgvector). Tendencias de topics por mes (LDA). "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 32000, "due_date": "2026-05-13T00:00:00.000Z",
    },
    {
        "title": "Dashboard Streamlit: comparativo Year-over-Year top-10 categorías",
        "description": (
            "Barras apiladas y líneas: GMV, volumen y review_score 2017 vs 2018. "
            "Filtro por región geográfica. Tabla con variación porcentual y ranking. "
            "Exportar tabla a CSV desde la UI. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 33000, "due_date": "2026-05-13T00:00:00.000Z",
    },
    {
        "title": "Dashboard Streamlit: simulador de escenarios what-if de demanda",
        "description": (
            "Sliders: precio, categoría, región de destino, fecha estimada. "
            "Salidas en tiempo real: demanda predicha (modelo), demora estimada "
            "(XGBoost), probabilidad de cancelación (LightGBM). "
            "Requirió integración con API FastAPI. La más compleja del dashboard. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 34000, "due_date": "2026-05-17T00:00:00.000Z",
    },
    {
        "title": "Dashboard Streamlit: integración chat RAG y panel de predicción en línea",
        "description": (
            "Conectar el chat con el sistema RAG de productos. Panel lateral de "
            "predicción rápida: input order_id → salida delay/cancellation. "
            "Complejidad: Baja — Estimado: 1 día."
        ),
        "priority": "medium", "position": 35000, "due_date": "2026-05-16T00:00:00.000Z",
    },

    # ── FASE 9: API y Deployment (sem 6-7 · 8 may – 20 may) ── 15 SP ─────────
    {
        "title": "API FastAPI: endpoints de predicción y recomendación (Pydantic v2)",
        "description": (
            "POST /predict/delay: recibe features del pedido, retorna days_estimated "
            "± IC y probabilidad is_late. GET /recommend/{customer_id}: top-10 "
            "productos. Autenticación JWT, validación Pydantic v2, docs Swagger. "
            "Latencia p95: 95ms. La tarea de mayor complejidad en esta fase. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 36000, "due_date": "2026-05-14T00:00:00.000Z",
    },
    {
        "title": "Caché Redis para predicciones API (TTL=1h, latencia 80ms → 5ms)",
        "description": (
            "Implementar caché Redis en /predict/delay con TTL=1 hora. "
            "Key: hash(features_input). Invalidación por reentrenamiento del modelo. "
            "Cache hit rate en prod: 73%. Mejora de latencia: 80ms → 5ms en hits. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 37000, "due_date": "2026-05-15T00:00:00.000Z",
    },
    {
        "title": "Containerización con Docker + docker-compose (API, Streamlit, MLflow)",
        "description": (
            "Dockerfiles optimizados (multi-stage) para api FastAPI y dashboard Streamlit. "
            "docker-compose.yml: api, streamlit, postgres, redis, mlflow, nginx. "
            "Health checks y restart policies. Variables de entorno desde .env. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 38000, "due_date": "2026-05-17T00:00:00.000Z",
    },
    {
        "title": "Deploy a Cloud Run con auto-scaling y endpoint HTTPS autenticado",
        "description": (
            "Publicar imagen en Artifact Registry. Cloud Run: min=1, max=10 instancias, "
            "CPU=1, RAM=2GB, concurrency=80. Endpoint HTTPS con autenticación IAM. "
            "Latencia cold-start: 1.2s. Latencia warm p99: 180ms. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 39000, "due_date": "2026-05-20T00:00:00.000Z",
    },

    # ── FASE 10: Monitoreo y automatización (sem 7-8 · 15-22 may) ── 11 SP ───
    {
        "title": "Monitoreo de concept drift con Evidently AI y alertas en Slack",
        "description": (
            "Evidently DataDriftReport mensual sobre features del modelo. "
            "Alerta automática en Slack cuando PSI > 0.2 en cualquier feature "
            "del top-10. Dashboard HTML generado y almacenado en S3. "
            "Primer drift detectado: delivery_days aumentó en región Norte. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 40000, "due_date": "2026-05-19T00:00:00.000Z",
    },
    {
        "title": "Pipeline de retraining mensual con Apache Airflow DAG",
        "description": (
            "DAG mensual: extrae datos nuevos → ETL Silver incremental → feature "
            "engineering → reentrenamiento XGBoost → validación vs modelo en prod "
            "(RMSE ± 5%) → push a MLflow Registry si mejora → deploy automático. "
            "Requirió semáforos en Airflow para evitar ejecuciones solapadas. "
            "La tarea de automatización más compleja del proyecto. "
            "Complejidad: Alta — Estimado: 5 días."
        ),
        "priority": "high", "position": 41000, "due_date": "2026-05-22T00:00:00.000Z",
    },
    {
        "title": "Informe ejecutivo semanal automático generado con Groq LLM",
        "description": (
            "Cron job semanal: consulta KPIs del DW, detecta anomalías, llama a "
            "Groq llama-3.3-70b para generar narrative en español. Output: informe "
            "PDF con métricas + análisis + alertas. Enviado por email (Resend). "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "medium", "position": 42000, "due_date": "2026-05-20T00:00:00.000Z",
    },

    # ── FASE 11: Revisión del cliente (sem 8 · 20-25 may) ── 5 SP ────────────
    {
        "title": "Preparación de la demo y slides ejecutivos para revisión del cliente",
        "description": (
            "Presentación de 15 min: contexto del proyecto, metodología, resultados "
            "cuantitativos (XGBoost RMSE=2.1d, ROC-AUC=0.87; LightGBM F1=0.83; "
            "dashboard en vivo). Demo guiada del simulador what-if. Script ensayado. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "high", "position": 43000, "due_date": "2026-05-21T00:00:00.000Z",
    },
    {
        "title": "Revisión del cliente + demo en vivo + incorporación de feedback",
        "description": (
            "Sesión de revisión con el cliente (2h). Demo en vivo del dashboard "
            "Streamlit y la API FastAPI. Feedback recibido: añadir filtro por "
            "franja de precio en el mapa y mejorar etiquetas del simulador. "
            "Ajustes implementados en el mismo día. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "high", "position": 44000, "due_date": "2026-05-23T00:00:00.000Z",
    },
    {
        "title": "Documentación técnica final: MkDocs + guía de operación",
        "description": (
            "Documentar en MkDocs Material: arquitectura del pipeline, APIs, "
            "decisiones de diseño, cómo reproducir el entorno, guía de operación "
            "para el equipo de producción. Deploy en GitHub Pages. "
            "Complejidad: Baja — Estimado: 1 día."
        ),
        "priority": "low", "position": 45000, "due_date": "2026-05-25T00:00:00.000Z",
    },
]

# ════════════════════════════════════════════════════════════════════════════════
# TAREAS EN PROGRESO — 2 tareas | 6 SP | (~4% del total)
# El equipo está ejecutando las pruebas esta semana
# ════════════════════════════════════════════════════════════════════════════════
IN_PROGRESS = [
    {
        "title": "Pruebas unitarias del pipeline ETL completo (pytest + testcontainers)",
        "description": (
            "Escribir tests unitarios para cada stage del ETL usando pytest. "
            "testcontainers para levantar PostgreSQL efímero. Validar: rowcounts, "
            "dtypes, constraints de negocio, idempotencia. Cobertura objetivo: 85%. "
            "Actualmente en 61% — faltan los stages Silver y Gold. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 1000, "due_date": "2026-05-30T00:00:00.000Z",
    },
    {
        "title": "Pruebas de integración end-to-end: Bronze → Silver → Gold → API",
        "description": (
            "Escenario completo: ingestar CSV de prueba → validar transformaciones "
            "Bronze/Silver/Gold → llamar a /predict/delay con un pedido sintético → "
            "verificar respuesta. Detectar regresiones en el pipeline completo. "
            "Actualmente bloqueado en el stage Gold por un bug en el join de dim_date. "
            "Complejidad: Media — Estimado: 3 días."
        ),
        "priority": "high", "position": 2000, "due_date": "2026-05-30T00:00:00.000Z",
    },
]

# ════════════════════════════════════════════════════════════════════════════════
# TAREAS PENDIENTES — 2 tareas | 4 SP | (~3% del total)
# Bloquean la entrega final — dependen de que las pruebas anteriores pasen
# ════════════════════════════════════════════════════════════════════════════════
TODO = [
    {
        "title": "Pruebas de carga API FastAPI con Locust (500 usuarios concurrentes)",
        "description": (
            "Simular 500 usuarios concurrentes en /predict/delay y /recommend. "
            "Objetivo: throughput ≥ 200 RPS, latencia p95 < 500ms. "
            "Si falla: ajustar configuración de Cloud Run (RAM, concurrency). "
            "Depende de que las pruebas de integración estén aprobadas. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "high", "position": 1000, "due_date": "2026-06-02T00:00:00.000Z",
    },
    {
        "title": "Validación QA del dashboard Streamlit y reporte de hallazgos",
        "description": (
            "Revisión sistemática del dashboard: consistencia de KPIs vs. PostgreSQL, "
            "correctitud del mapa coroplético, funcionamiento del simulador what-if "
            "con casos borde. Documentar hallazgos y bugs en el backlog. "
            "Complejidad: Media — Estimado: 2 días."
        ),
        "priority": "medium", "position": 2000, "due_date": "2026-06-02T00:00:00.000Z",
    },
]

# ════════════════════════════════════════════════════════════════════════════════
# Verificación de pesos (story points)
# ════════════════════════════════════════════════════════════════════════════════
# DONE SP  = 8+9+19+9+9+23+10+17+15+11+5 = 135
# PENDING  = 6 + 4 = 10
# TOTAL    = 145
# DONE %   = 135/145 = 93.1% ✓


# ── Helpers ────────────────────────────────────────────────────────────────────
def delete_tasks(user_id: str) -> int:
    body = json.dumps({"user_id": user_id}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/tasks?user_id=eq.{user_id}",
        headers=HEADERS, method="DELETE"
    )
    req.add_header("Prefer", "return=representation")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return len(data) if isinstance(data, list) else 0
    except Exception:
        return 0


def insert_tasks(rows: list) -> list:
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/tasks",
        data=body, headers=HEADERS, method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def build_rows(tasks, status, user_id, project_id):
    return [
        {**t, "status": status, "user_id": user_id, "project_id": project_id}
        for t in tasks
    ]


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f"Borrando tareas existentes...")
    deleted_total = 0
    for user_id, project_id in USERS_PROJECTS:
        n = delete_tasks(user_id)
        deleted_total += n
        print(f"  del {user_id[:8]}... -> {n} eliminadas")

    print(f"\nInsertando {len(DONE)+len(IN_PROGRESS)+len(TODO)} tareas por usuario...")
    inserted_total = 0

    for user_id, project_id in USERS_PROJECTS:
        rows = (
            build_rows(DONE,        "done",        user_id, project_id) +
            build_rows(IN_PROGRESS, "in_progress", user_id, project_id) +
            build_rows(TODO,        "todo",         user_id, project_id)
        )
        try:
            result = insert_tasks(rows)
            n = len(result)
            inserted_total += n
            done_n = len(DONE)
            ip_n   = len(IN_PROGRESS)
            todo_n = len(TODO)
            print(f"  ins {user_id[:8]}... -> {n} tareas "
                  f"(done={done_n} | in_progress={ip_n} | todo={todo_n})")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  ERR {user_id[:8]}... -> HTTP {e.code}: {body[:300]}")

    sp_done    = 135
    sp_total   = 145
    pct        = sp_done / sp_total * 100

    print(f"\n{'='*55}")
    print(f"  Total insertado : {inserted_total} tareas ({len(USERS_PROJECTS)} usuarios)")
    print(f"  Tareas done     : {len(DONE)} (135 SP)")
    print(f"  Tareas in_prog  : {len(IN_PROGRESS)} (6 SP)")
    print(f"  Tareas todo     : {len(TODO)} (4 SP)")
    print(f"  Avance proyecto : {pct:.1f}%")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
