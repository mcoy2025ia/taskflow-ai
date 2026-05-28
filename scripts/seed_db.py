"""
Script de seed directo a Supabase vía REST API (service_role).
Inserta 62 tareas Olist por usuario en sus proyectos Pipeline Olist.
"""

import json
import urllib.request
import os
import sys
from pathlib import Path

# ── Configuración ──────────────────────────────────────────────────────────────
SUPABASE_URL = "https://oxygmdwxfjkecgycoumz.supabase.co"

# Leer .env.local
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SERVICE_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY no encontrado en .env.local")
    sys.exit(1)

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# ── Usuarios y proyectos ───────────────────────────────────────────────────────
USERS_PROJECTS = [
    ("9834c505-6bbc-4914-96f6-5cfa6eb89c4f", "4a4947be-d219-4048-a3fc-838a94fe4283", "mcoyllmdata"),
    ("1e6538cb-c25b-4039-8bcd-9d7a5383c760", "a900687c-a653-4c59-9196-2f910451e734", "manuelalbertocoy"),
    ("7c7145d3-6fe5-4daf-95e9-57096674c56c", "3dfff950-d4cc-4194-bf09-242dd4408d20", "hotmail"),
    ("9dc2eaa0-07c4-4f51-b6bb-ea1a11365581", "4bad66eb-2b09-4645-a106-90abdce1629b", "uandes"),
]

# ── 22 tareas DONE ─────────────────────────────────────────────────────────────
DONE_TASKS = [
    {"title": "Descarga y exploración inicial del dataset Olist",
     "description": "Obtener los 9 CSV del dataset Kaggle Olist (100K+ pedidos). Verificar integridad, tamaños, encodings y columnas clave antes de iniciar el pipeline.",
     "priority": "high", "position": 1000, "due_date": "2025-03-07T00:00:00.000Z"},
    {"title": "Análisis de calidad de datos (DQ Report)",
     "description": "Calcular tasa de nulos, duplicados y outliers por columna. Documentar hallazgos en un informe DQ con pandas-profiling. Criterio de aceptación: menos del 5% de nulos en campos críticos.",
     "priority": "high", "position": 2000, "due_date": "2025-03-10T00:00:00.000Z"},
    {"title": "ETL Bronze: carga cruda CSV hacia PostgreSQL",
     "description": "Cargar los 9 CSV tal cual al esquema bronze de PostgreSQL usando pandas y SQLAlchemy. Sin transformaciones. Registrar filas insertadas y tiempo de ejecución en MLflow.",
     "priority": "high", "position": 3000, "due_date": "2025-03-14T00:00:00.000Z"},
    {"title": "Limpieza Bronze: nulos, duplicados y tipos de datos",
     "description": "Eliminar registros duplicados en orders y order_items. Coerción de fechas a datetime64 UTC. Normalizar campos de texto (strip, lower). Guardar capa Bronze limpia.",
     "priority": "high", "position": 4000, "due_date": "2025-03-17T00:00:00.000Z"},
    {"title": "ETL Silver: transformación y enriquecimiento de órdenes",
     "description": "Calcular columnas derivadas: delivery_days, is_late, review_delay. Join de orders, order_items, products y sellers. Guardar tabla fact_orders en capa Silver.",
     "priority": "high", "position": 5000, "due_date": "2025-03-21T00:00:00.000Z"},
    {"title": "ETL Silver: pipeline de clientes y geolocalización",
     "description": "Normalizar tabla de clientes y geolocalización lat/lng por CEP. Calcular distancia vendedor-comprador en km usando fórmula de Haversine. Índice espacial en PostgreSQL.",
     "priority": "medium", "position": 6000, "due_date": "2025-03-24T00:00:00.000Z"},
    {"title": "Modelado del esquema estrella para Data Warehouse",
     "description": "Diseñar fact_orders con dimensiones dim_customer, dim_product, dim_seller, dim_date, dim_geo. Diagrama ER en draw.io. Normalización 3FN en dims y desnormalización controlada en facts.",
     "priority": "high", "position": 7000, "due_date": "2025-03-14T00:00:00.000Z"},
    {"title": "EDA: análisis de ventas por estado brasileño",
     "description": "Mapa de calor de GMV y volumen por estado (SP lidera con 42%). Análisis de estacionalidad mensual 2016-2018. Visualizaciones con Matplotlib y Seaborn exportadas a PNG.",
     "priority": "medium", "position": 8000, "due_date": "2025-03-28T00:00:00.000Z"},
    {"title": "EDA: top categorías por GMV y volumen de pedidos",
     "description": "Ranking de las 20 categorías principales por GMV. Análisis de ticket promedio y margen por categoría. Detección de categorías con alta varianza en review_score.",
     "priority": "medium", "position": 9000, "due_date": "2025-03-31T00:00:00.000Z"},
    {"title": "Cálculo de KPIs core: GMV, ticket promedio y churn",
     "description": "Definir y calcular: GMV mensual, ticket promedio, tasa de recompra 6.4%, tasa de cancelación 2.1%, LTV estimado. Almacenar en tabla kpi_summary con partición por mes.",
     "priority": "high", "position": 10000, "due_date": "2025-04-04T00:00:00.000Z"},
    {"title": "Segmentación RFM de clientes con K-Means (k=5)",
     "description": "Calcular Recency, Frequency, Monetary por cliente. Normalización MinMax. K-Means con k=5 y silhouette=0.62. Etiquetar segmentos: Champions, Loyalists, At-Risk, Lost, New.",
     "priority": "high", "position": 11000, "due_date": "2025-04-07T00:00:00.000Z"},
    {"title": "Feature engineering: variables temporales y estacionales",
     "description": "Extraer: día de semana, mes, trimestre, semana del año, días hasta Black Friday. Crear flag is_weekend e is_holiday_br. One-hot encoding de variables categóricas de alta cardinalidad.",
     "priority": "medium", "position": 12000, "due_date": "2025-04-11T00:00:00.000Z"},
    {"title": "Feature engineering: variables geográficas y logísticas",
     "description": "Distancia vendedor-comprador con Haversine, región de Brasil N/NE/CO/SE/S, densidad logística por estado. Variables de demora histórica por ruta y categoría.",
     "priority": "medium", "position": 13000, "due_date": "2025-04-14T00:00:00.000Z"},
    {"title": "Entrenamiento XGBoost: predicción de días de demora",
     "description": "Modelo de regresión XGBoost con 50+ features. RMSE=2.3 días en test set. Hyperparams iniciales: n_estimators=500, max_depth=6, learning_rate=0.05, subsample=0.8.",
     "priority": "high", "position": 14000, "due_date": "2025-04-18T00:00:00.000Z"},
    {"title": "Evaluación modelo XGBoost: métricas y curvas ROC",
     "description": "Calcular RMSE, MAE, R cuadrado, ROC-AUC=0.87 en versión clasificación is_late. Curvas de aprendizaje, importancia de features top-20. Análisis de residuos por región y categoría.",
     "priority": "high", "position": 15000, "due_date": "2025-04-21T00:00:00.000Z"},
    {"title": "Análisis de sentimientos en reviews con BERT-pt",
     "description": "Fine-tuning de neuralmind/bert-base-portuguese-cased para clasificación 1-5 estrellas. F1-macro=0.79 en test. Embeddings de reviews almacenados en Supabase con halfvec(768).",
     "priority": "high", "position": 16000, "due_date": "2025-04-25T00:00:00.000Z"},
    {"title": "Pipeline de embeddings de reseñas con Voyage AI",
     "description": "Generar embeddings voyage-3-lite (512 dims) para todas las reseñas del dataset. Índice HNSW en pgvector para búsqueda semántica. Batch processing con rate limiting de 21 req/s.",
     "priority": "medium", "position": 17000, "due_date": "2025-04-28T00:00:00.000Z"},
    {"title": "Setup de MLflow para tracking de experimentos",
     "description": "Configurar MLflow Tracking Server con backend PostgreSQL y artifact store en S3. Registrar todas las runs de XGBoost, LightGBM y BERT. Model registry con stages dev/staging/prod.",
     "priority": "medium", "position": 18000, "due_date": "2025-03-21T00:00:00.000Z"},
    {"title": "Versionado del dataset con DVC y remote S3",
     "description": "Inicializar DVC en el repositorio. Configurar remote en S3. Versionar los 9 CSV originales y las capas Bronze/Silver/Gold. Pipeline DVC con stages reproducibles mediante dvc repro.",
     "priority": "medium", "position": 19000, "due_date": "2025-03-17T00:00:00.000Z"},
    {"title": "Clustering de vendedores por volumen y rating (DBSCAN)",
     "description": "Agrupar vendedores por volumen de pedidos, GMV y review_score usando DBSCAN con eps=0.3 y min_samples=5. Identificar vendedores élite, problemáticos y nichos de alto margen.",
     "priority": "medium", "position": 20000, "due_date": "2025-04-04T00:00:00.000Z"},
    {"title": "Documentación del esquema Olist y decisiones ETL",
     "description": "Documentar en mkdocs: esquema de tablas, transformaciones aplicadas, criterios de limpieza, campos derivados y supuestos del modelo de negocio. Incluir diagrama ER interactivo.",
     "priority": "low", "position": 21000, "due_date": "2025-05-05T00:00:00.000Z"},
    {"title": "Configuración del entorno: conda env y requirements.txt",
     "description": "Crear environment.yml con Python 3.11, pandas, scikit-learn, xgboost, lightgbm, transformers, mlflow, dvc, streamlit, fastapi. Instrucciones de reproducción en README.md.",
     "priority": "low", "position": 22000, "due_date": "2025-03-07T00:00:00.000Z"},
]

# ── 20 tareas IN PROGRESS ──────────────────────────────────────────────────────
IN_PROGRESS_TASKS = [
    {"title": "Modelo de recomendación collaborative filtering (ALS)",
     "description": "Implementar Alternating Least Squares con implicit o PySpark. User-item matrix de clientes por categorías. Evaluar con Precision@10 y NDCG@10 usando split temporal.",
     "priority": "high", "position": 1000, "due_date": "2026-06-10T00:00:00.000Z"},
    {"title": "Dashboard Streamlit: mapa de ventas por estado BR",
     "description": "Visualizar GMV, volumen y review_score en mapa coroplético de Brasil con Folium/Plotly. Filtros por período y categoría. Tooltips con top-3 productos por estado.",
     "priority": "high", "position": 2000, "due_date": "2026-06-07T00:00:00.000Z"},
    {"title": "Pipeline de retraining mensual con Apache Airflow",
     "description": "DAG mensual: extrae datos nuevos, ETL Silver, feature engineering, reentrenamiento XGBoost, validación vs modelo en prod, push al Model Registry si mejora RMSE en 2% o más.",
     "priority": "high", "position": 3000, "due_date": "2026-06-20T00:00:00.000Z"},
    {"title": "Forecasting de ventas 2026 con Prophet (series temporales)",
     "description": "Series temporales de GMV diario con Prophet. Incorporar seasonality brasileña: Carnaval, Black Friday, Navidad. Intervalos de confianza al 95%. Comparar contra SARIMA y LSTM.",
     "priority": "medium", "position": 4000, "due_date": "2026-06-14T00:00:00.000Z"},
    {"title": "Detección de anomalías en transacciones con Isolation Forest",
     "description": "Entrenar Isolation Forest con contamination=0.01 sobre features de pedidos: monto, hora, geolocalización, historial del cliente. Alertas en tiempo real vía endpoint FastAPI.",
     "priority": "high", "position": 5000, "due_date": "2026-06-17T00:00:00.000Z"},
    {"title": "API FastAPI para servir predicciones del modelo XGBoost",
     "description": "Endpoints POST /predict/delay y GET /recommend/{customer_id}. Autenticación JWT. Carga del modelo desde MLflow Model Registry. Validación de entrada con Pydantic v2.",
     "priority": "high", "position": 6000, "due_date": "2026-06-10T00:00:00.000Z"},
    {"title": "Optimización de hiperparámetros XGBoost con Optuna (100 trials)",
     "description": "100 trials de búsqueda bayesiana: n_estimators 100-1000, max_depth 3-10, learning_rate 0.01-0.3, subsample 0.6-1.0. Objetivo: minimizar RMSE en CV 5-fold temporal.",
     "priority": "medium", "position": 7000, "due_date": "2026-06-07T00:00:00.000Z"},
    {"title": "Dashboard Streamlit: módulo de análisis de reseñas NLP",
     "description": "Nube de palabras por rating. Distribución de sentimientos por categoría y estado. Búsqueda semántica de reviews usando embeddings Voyage AI. Tendencias de topics por mes.",
     "priority": "medium", "position": 8000, "due_date": "2026-06-14T00:00:00.000Z"},
    {"title": "Informe ejecutivo automático con LLM (Groq Llama-3.3-70b)",
     "description": "Generar narrative automático de KPIs semanales usando Groq llama-3.3-70b. Input: métricas del DW. Output: análisis de tendencias, alertas y recomendaciones en español.",
     "priority": "high", "position": 9000, "due_date": "2026-06-17T00:00:00.000Z"},
    {"title": "Pruebas de integración del pipeline ETL end-to-end",
     "description": "Tests con pytest y testcontainers (PostgreSQL en Docker). Validar que cada stage Bronze/Silver/Gold produce el schema esperado. Cobertura mayor al 80% en funciones ETL críticas.",
     "priority": "medium", "position": 10000, "due_date": "2026-06-07T00:00:00.000Z"},
    {"title": "Análisis de cohortes de clientes 2016-2018",
     "description": "Cohort retention mensual: porcentaje de clientes que repiten en los 12 meses siguientes a su primera compra. Heatmap de retención. Comparar cohorts por estado y categoría inicial.",
     "priority": "medium", "position": 11000, "due_date": "2026-06-14T00:00:00.000Z"},
    {"title": "Modelo LightGBM: predicción de cancelación de pedidos",
     "description": "Clasificación binaria is_cancelled. Features: historial del cliente, vendedor, logística, monto. Objetivo: F1 mayor o igual a 0.80. SMOTE para balancear clases. Threshold con Platt scaling.",
     "priority": "high", "position": 12000, "due_date": "2026-06-20T00:00:00.000Z"},
    {"title": "Monitoreo de concept drift con Evidently AI",
     "description": "Configurar EvidentlyAI para detectar data drift y model performance drift mensualmente. Dashboard HTML automático. Alertas en Slack cuando el PSI supere 0.2 en features críticos.",
     "priority": "medium", "position": 13000, "due_date": "2026-06-24T00:00:00.000Z"},
    {"title": "RAG sobre catálogo y descripciones de productos Olist",
     "description": "Indexar título, descripción y categoría de 33K productos con Voyage AI. Búsqueda semántica vía pgvector más reranking rerank-2-lite. Integrar en chat del dashboard Streamlit.",
     "priority": "high", "position": 14000, "due_date": "2026-06-20T00:00:00.000Z"},
    {"title": "Documentación técnica del pipeline ML con MkDocs Material",
     "description": "Documentar arquitectura, decisiones de diseño, APIs y guía de desarrollo en MkDocs Material. Diagramas Mermaid para flujos de datos. Deploy automático en GitHub Pages.",
     "priority": "low", "position": 15000, "due_date": "2026-07-01T00:00:00.000Z"},
    {"title": "Validación cruzada 5-fold temporal y análisis de overfitting",
     "description": "Implementar TimeSeriesSplit con 5 folds para evitar data leakage. Comparar train vs validation curves. Detectar overfitting por región y categoría. Regularización con early_stopping.",
     "priority": "medium", "position": 16000, "due_date": "2026-06-14T00:00:00.000Z"},
    {"title": "Dashboard Streamlit: comparativo YoY top-10 categorías",
     "description": "Gráficos de barras apiladas y líneas para comparar 2017 vs 2018 por categoría: GMV, volumen, review_score. Filtro por región. Exportar a PNG y CSV desde el sidebar.",
     "priority": "medium", "position": 17000, "due_date": "2026-06-10T00:00:00.000Z"},
    {"title": "Contenerización del pipeline con Docker y docker-compose",
     "description": "Dockerfiles para: api FastAPI, scheduler Airflow, Streamlit dashboard. docker-compose.yml con PostgreSQL, Redis, MLflow Tracking Server. Configuración de redes y volúmenes.",
     "priority": "high", "position": 18000, "due_date": "2026-06-24T00:00:00.000Z"},
    {"title": "Segmentación geográfica de demanda para rutas logísticas",
     "description": "Clustering geoespacial de demanda con DBSCAN sobre lat/lng de clientes. Identificar zonas de alta densidad. Mapa interactivo con Folium. Recomendaciones de hubs logísticos.",
     "priority": "medium", "position": 19000, "due_date": "2026-06-17T00:00:00.000Z"},
    {"title": "Análisis de elasticidad de precio por categoría de producto",
     "description": "Regresión log-log entre precio y volumen por categoría. Calcular elasticidad-precio propia. Identificar categorías inelásticas (margen) vs elásticas (volumen). Simulador de escenarios.",
     "priority": "medium", "position": 20000, "due_date": "2026-06-24T00:00:00.000Z"},
]

# ── 20 tareas TODO ─────────────────────────────────────────────────────────────
TODO_TASKS = [
    {"title": "Deploy del modelo XGBoost a Vertex AI (Cloud Run)",
     "description": "Empaquetar modelo MLflow como contenedor Docker. Deploy en Google Cloud Run con auto-scaling. Endpoint HTTPS con autenticación IAM. Latencia objetivo menor a 200ms en p99.",
     "priority": "high", "position": 1000, "due_date": "2026-07-15T00:00:00.000Z"},
    {"title": "A/B testing para el modelo de recomendación",
     "description": "Split 50/50 entre modelo ALS y baseline (best-seller por categoría). Métricas: CTR, conversión, revenue por sesión. Duración: 4 semanas. Análisis estadístico con bootstrap.",
     "priority": "high", "position": 2000, "due_date": "2026-07-22T00:00:00.000Z"},
    {"title": "Dashboard Streamlit: panel de predicción en tiempo real",
     "description": "Input: parámetros de un pedido hipotético. Output: días de entrega estimados, probabilidad de cancelación y productos recomendados. Integrado con la API FastAPI via requests.",
     "priority": "high", "position": 3000, "due_date": "2026-07-08T00:00:00.000Z"},
    {"title": "Grafo de conocimiento de productos con NetworkX y Neo4j",
     "description": "Construir grafo donde nodos son productos y aristas representan co-compra. Calcular centralidad, comunidades con Louvain y productos puente. Visualización interactiva con PyVis.",
     "priority": "medium", "position": 4000, "due_date": "2026-07-29T00:00:00.000Z"},
    {"title": "Fine-tuning LLM para clasificación de categorías Olist",
     "description": "LoRA fine-tuning de Llama-3.1-8B sobre pares descripcion_producto hacia categoría. Dataset: 30K ejemplos. Evaluación: accuracy top-1 y top-5. Deploy en Ollama local y Groq.",
     "priority": "high", "position": 5000, "due_date": "2026-08-05T00:00:00.000Z"},
    {"title": "Pipeline de streaming con Kafka y Spark Structured Streaming",
     "description": "Producir eventos de pedido en tiempo real a Kafka. Consumir con Spark Structured Streaming: agregaciones en ventana de 5 min. Detectar anomalías on-the-fly. Sink a PostgreSQL.",
     "priority": "medium", "position": 6000, "due_date": "2026-08-12T00:00:00.000Z"},
    {"title": "Análisis causal: impacto de reviews en pedidos futuros",
     "description": "Usar DoWhy para estimar el efecto causal de review_score en la probabilidad de recompra. Controlar por confounders: precio, categoría, región. Refutation tests para validez.",
     "priority": "medium", "position": 7000, "due_date": "2026-07-29T00:00:00.000Z"},
    {"title": "Pruebas de carga para la API FastAPI con Locust (500 usuarios)",
     "description": "Simular 500 usuarios concurrentes en endpoint /predict/delay. Objetivo: throughput mayor a 200 RPS, latencia p95 menor a 500ms. Identificar bottlenecks y optimizar caché Redis.",
     "priority": "medium", "position": 8000, "due_date": "2026-07-15T00:00:00.000Z"},
    {"title": "SHAP para explicabilidad del modelo XGBoost",
     "description": "Calcular SHAP values globales (feature importance) y locales (explicación por pedido). Plots: beeswarm, waterfall, dependency. Integrar explicaciones en la respuesta de la API.",
     "priority": "high", "position": 9000, "due_date": "2026-07-08T00:00:00.000Z"},
    {"title": "Reporte ejecutivo PDF automático con LLM y jsPDF",
     "description": "Generar PDF semanal con: KPIs actualizados, gráficos PNG, análisis narrativo del LLM y alertas de anomalías. Programado con cron. Enviar por email con Resend API.",
     "priority": "medium", "position": 10000, "due_date": "2026-07-15T00:00:00.000Z"},
    {"title": "Pipeline incremental de ingesta de datos nuevos (daily batch)",
     "description": "Detectar nuevos CSV o registros en S3 basado en timestamp. Ejecutar ETL Bronze hacia Silver hacia Gold solo sobre incrementos. Idempotente: safe para re-run. Logs en CloudWatch.",
     "priority": "medium", "position": 11000, "due_date": "2026-07-22T00:00:00.000Z"},
    {"title": "Evaluación de fairness y sesgos en modelos con Fairlearn",
     "description": "Medir disparidad de RMSE del modelo de demora por región (Norte vs Sureste). Aplicar mitigación con GridSearch de Fairlearn. Documentar trade-off entre fairness y accuracy global.",
     "priority": "high", "position": 12000, "due_date": "2026-07-29T00:00:00.000Z"},
    {"title": "Integración con Power BI vía conector REST custom",
     "description": "Crear conector Power BI que consulte la API FastAPI para traer KPIs y predicciones. Autenticación OAuth2. Refresh automático cada hora. Publicar en Power BI Service.",
     "priority": "low", "position": 13000, "due_date": "2026-08-19T00:00:00.000Z"},
    {"title": "Validación del modelo con dataset hold-out 2018 Q4",
     "description": "Evaluar modelo XGBoost y LightGBM en datos de Q4 2018 nunca vistos en train. Comparar degradación de RMSE. Análisis de error por categoría, región y valor del pedido.",
     "priority": "high", "position": 14000, "due_date": "2026-07-08T00:00:00.000Z"},
    {"title": "Publicación del notebook final con Quarto en GitHub Pages",
     "description": "Convertir notebooks Jupyter a Quarto. Renderizar HTML con código, outputs y narrativa. Deploy automático en GitHub Pages desde main branch. DOI con Zenodo para citar.",
     "priority": "low", "position": 15000, "due_date": "2026-08-26T00:00:00.000Z"},
    {"title": "Caché de predicciones con Redis para la API FastAPI",
     "description": "Cachear respuestas de /predict/delay con Redis TTL=1h. Invalidación por re-entrenamiento del modelo. Medir mejora de latencia: baseline 80ms hacia objetivo de 5ms en cache hit.",
     "priority": "medium", "position": 16000, "due_date": "2026-07-15T00:00:00.000Z"},
    {"title": "Dashboard Streamlit: simulador de escenarios what-if",
     "description": "Sliders para ajustar: precio, categoría, región de destino, fecha estimada. El simulador muestra en tiempo real cambios en: demanda predicha, demora estimada y probabilidad de cancelación.",
     "priority": "high", "position": 17000, "due_date": "2026-07-22T00:00:00.000Z"},
    {"title": "Análisis de red de vendedores con graph analytics (NetworkX)",
     "description": "Grafo de vendedores conectados por categorías compartidas. Centralidad de grado y betweenness. Detectar vendedores dominantes por categoría. Visualizar con Gephi y NetworkX.",
     "priority": "low", "position": 18000, "due_date": "2026-08-05T00:00:00.000Z"},
    {"title": "Modelo de estimación de tiempo de entrega en tiempo real",
     "description": "Modelo online con River ML que aprende incrementalmente de nuevos pedidos. Integrar en la API FastAPI como segunda opinión al XGBoost batch. Comparar RMSE rolling por semana.",
     "priority": "high", "position": 19000, "due_date": "2026-07-29T00:00:00.000Z"},
    {"title": "Presentación final de resultados y cierre del proyecto",
     "description": "Preparar slides ejecutivos de 15 min: objetivos, metodología, resultados cuantitativos, demo en vivo del dashboard Streamlit. Documento de lecciones aprendidas y próximos pasos.",
     "priority": "medium", "position": 20000, "due_date": "2026-09-01T00:00:00.000Z"},
]


def insert_batch(rows: list) -> list:
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/tasks",
        data=body,
        headers=HEADERS,
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main():
    total = 0
    for user_id, project_id, label in USERS_PROJECTS:
        rows = []
        for t in DONE_TASKS:
            rows.append({**t, "status": "done", "user_id": user_id, "project_id": project_id})
        for t in IN_PROGRESS_TASKS:
            rows.append({**t, "status": "in_progress", "user_id": user_id, "project_id": project_id})
        for t in TODO_TASKS:
            rows.append({**t, "status": "todo", "user_id": user_id, "project_id": project_id})

        try:
            result = insert_batch(rows)
            n = len(result)
            total += n
            print(f"  OK  {label}: {n} tareas insertadas")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  ERR {label}: HTTP {e.code} — {body[:200]}")
        except Exception as exc:
            print(f"  ERR {label}: {exc}")

    print(f"\nTotal insertado: {total} tareas en {len(USERS_PROJECTS)} usuarios")


if __name__ == "__main__":
    main()
