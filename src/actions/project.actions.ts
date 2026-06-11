'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'

export interface ProjectSummary {
  id: string
  name: string
  start_date: string
  delivery_date: string
  role: 'owner' | 'editor' | 'viewer'
  task_count: number
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
})

export async function getProjects(): Promise<ActionResult<ProjectSummary[]>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  const [{ data: projectsData, error }, { data: memberships }, { data: taskCounts }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, start_date, delivery_date, user_id')
      .order('created_at'),
    supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', user.id),
    supabase
      .from('tasks')
      .select('project_id')
      .not('project_id', 'is', null),
  ])

  if (error) return { success: false, error: error.message }

  const roleMap = new Map(memberships?.map(m => [m.project_id, m.role as ProjectSummary['role']]) ?? [])

  // Count tasks per project
  const countMap = new Map<string, number>()
  for (const t of taskCounts ?? []) {
    if (t.project_id) countMap.set(t.project_id, (countMap.get(t.project_id) ?? 0) + 1)
  }

  const projects = (projectsData ?? [])
    .map(p => ({
      id: p.id,
      name: p.name,
      start_date: p.start_date as string,
      delivery_date: p.delivery_date as string,
      role: roleMap.get(p.id) ?? (p.user_id === user.id ? 'owner' : 'viewer') as ProjectSummary['role'],
      task_count: countMap.get(p.id) ?? 0,
    }))
    // Most active project first
    .sort((a, b) => b.task_count - a.task_count)

  return { success: true, data: projects }
}

export async function createProject(
  input: z.infer<typeof CreateProjectSchema>
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = CreateProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, ...parsed.data })
    .select('id, name')
    .single()

  if (error || !project) {
    return { success: false, error: error?.message ?? 'Error al crear proyecto' }
  }

  // Register creator as owner in project_members (migration 007 backfills existing;
  // new projects need this explicit insert)
  await supabase
    .from('project_members')
    .insert({ project_id: project.id, user_id: user.id, role: 'owner' })

  return { success: true, data: { id: project.id, name: project.name } }
}

const DEMO_TASKS = [
  { title: 'Definir requerimientos del proyecto',   status: 'done',        priority: 'high',   position: 1000 },
  { title: 'Diseñar arquitectura de la base de datos', status: 'done',     priority: 'high',   position: 2000 },
  { title: 'Configurar entorno de desarrollo',       status: 'done',        priority: 'medium', position: 3000 },
  { title: 'Implementar autenticación de usuarios',  status: 'in_progress', priority: 'high',   position: 1000 },
  { title: 'Crear API REST para gestión de tareas',  status: 'in_progress', priority: 'high',   position: 2000 },
  { title: 'Diseñar interfaz de usuario',            status: 'in_progress', priority: 'medium', position: 3000 },
  { title: 'Integrar sistema de notificaciones',     status: 'todo',        priority: 'medium', position: 1000 },
  { title: 'Escribir pruebas unitarias',             status: 'todo',        priority: 'medium', position: 2000 },
  { title: 'Optimizar rendimiento de consultas',     status: 'todo',        priority: 'low',    position: 3000 },
  { title: 'Preparar documentación de despliegue',   status: 'todo',        priority: 'low',    position: 4000 },
] as const

export async function seedDemoProject(): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()
  const today = new Date()
  const delivery = new Date(today)
  delivery.setDate(today.getDate() + 30)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: 'Proyecto Demo', start_date: fmt(today), delivery_date: fmt(delivery) })
    .select('id')
    .single()

  if (projErr || !project) {
    return { success: false, error: projErr?.message ?? 'Error al crear proyecto demo' }
  }

  await supabase.from('project_members').insert({ project_id: project.id, user_id: user.id, role: 'owner' })

  await supabase.from('tasks').insert(
    DEMO_TASKS.map(t => ({ ...t, user_id: user.id, project_id: project.id }))
  )

  return { success: true, data: { id: project.id } }
}

// ── Helper interno para generar embeddings (fire-and-forget) ──────────────────
async function triggerEmbeddingLocal(taskId: string, title: string, description?: string | null) {
  try {
    const { signRequest } = await import('@/lib/hmac')
    const path = '/api/embed'
    const body = JSON.stringify({ taskId, title, description })
    const hmacHeaders = await signRequest(path, body)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hmacHeaders },
      body,
    })
  } catch (err) {
    console.error('[embed] triggerEmbeddingLocal falló para tarea', taskId, err)
  }
}

// ── Dataset Olist — 20+ tareas por estado ─────────────────────────────────────
// Proyecto: Pipeline Olist — Ingeniería de datos · ML · IA · Streamlit
// Ciclo: Bronze → Silver → Gold → Feature Eng → ML → Dashboard → Informe

type SeedTask = {
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  position: number
  due_date: string
}

const OLIST_DONE: Omit<SeedTask, 'status'>[] = [
  {
    title: 'Descarga y exploración inicial del dataset Olist',
    description: 'Obtener los 9 CSV del dataset Kaggle Olist (100K+ pedidos). Verificar integridad, tamaños, encodings y columnas clave antes de iniciar el pipeline.',
    priority: 'high', position: 1000, due_date: '2025-03-07T00:00:00.000Z',
  },
  {
    title: 'Análisis de calidad de datos (DQ Report)',
    description: 'Calcular tasa de nulos, duplicados y outliers por columna. Documentar hallazgos en un informe DQ con pandas-profiling. Criterio de aceptación: < 5% nulos en campos críticos.',
    priority: 'high', position: 2000, due_date: '2025-03-10T00:00:00.000Z',
  },
  {
    title: 'ETL Bronze: carga cruda CSV → PostgreSQL',
    description: 'Cargar los 9 CSV tal cual al esquema bronze de PostgreSQL usando pandas + SQLAlchemy. Sin transformaciones. Registrar filas insertadas y tiempo de ejecución en MLflow.',
    priority: 'high', position: 3000, due_date: '2025-03-14T00:00:00.000Z',
  },
  {
    title: 'Limpieza Bronze: nulos, duplicados y tipos de datos',
    description: 'Eliminar registros duplicados en orders y order_items. Coerción de fechas a datetime64[UTC]. Normalizar campos de texto (strip, lower). Guardar capa Bronze limpia.',
    priority: 'high', position: 4000, due_date: '2025-03-17T00:00:00.000Z',
  },
  {
    title: 'ETL Silver: transformación y enriquecimiento de órdenes',
    description: 'Calcular columnas derivadas: delivery_days, is_late, review_delay. Join de orders + order_items + products + sellers. Guardar tabla fact_orders en capa Silver.',
    priority: 'high', position: 5000, due_date: '2025-03-21T00:00:00.000Z',
  },
  {
    title: 'ETL Silver: pipeline de clientes y geolocalización',
    description: 'Normalizar tabla de clientes y geolocalización (lat/lng por CEP). Calcular distancia vendedor-comprador en km usando fórmula de Haversine. Índice espacial en PostgreSQL.',
    priority: 'medium', position: 6000, due_date: '2025-03-24T00:00:00.000Z',
  },
  {
    title: 'Modelado del esquema estrella para Data Warehouse',
    description: 'Diseñar fact_orders con dimensiones dim_customer, dim_product, dim_seller, dim_date, dim_geo. Diagrama ER en draw.io. Normalización 3FN en dims y desnormalización controlada en facts.',
    priority: 'high', position: 7000, due_date: '2025-03-14T00:00:00.000Z',
  },
  {
    title: 'EDA: análisis de ventas por estado brasileño',
    description: 'Mapa de calor de GMV y volumen por estado (SP lidera con 42%). Análisis de estacionalidad mensual 2016-2018. Visualizaciones con Matplotlib/Seaborn exportadas a PNG.',
    priority: 'medium', position: 8000, due_date: '2025-03-28T00:00:00.000Z',
  },
  {
    title: 'EDA: top categorías por GMV y volumen de pedidos',
    description: 'Ranking de las 20 categorías principales por GMV. Análisis de ticket promedio y margen por categoría. Detección de categorías con alta varianza en review_score.',
    priority: 'medium', position: 9000, due_date: '2025-03-31T00:00:00.000Z',
  },
  {
    title: 'Cálculo de KPIs core: GMV, ticket promedio, churn',
    description: 'Definir y calcular: GMV mensual, ticket promedio, tasa de recompra (6.4%), tasa de cancelación (2.1%), LTV estimado. Almacenar en tabla kpi_summary con partición por mes.',
    priority: 'high', position: 10000, due_date: '2025-04-04T00:00:00.000Z',
  },
  {
    title: 'Segmentación RFM de clientes con K-Means (k=5)',
    description: 'Calcular Recency, Frequency, Monetary por cliente. Normalización MinMax. K-Means con k=5 (silhouette=0.62). Etiquetar segmentos: Champions, Loyalists, At-Risk, Lost, New.',
    priority: 'high', position: 11000, due_date: '2025-04-07T00:00:00.000Z',
  },
  {
    title: 'Feature engineering: variables temporales y estacionales',
    description: 'Extraer: día de semana, mes, trimestre, semana del año, días hasta Black Friday. Crear flag is_weekend, is_holiday_br. One-hot encoding de variables categóricas de alta cardinalidad.',
    priority: 'medium', position: 12000, due_date: '2025-04-11T00:00:00.000Z',
  },
  {
    title: 'Feature engineering: variables geográficas y logísticas',
    description: 'Distancia vendedor-comprador (Haversine), región de Brasil (N/NE/CO/SE/S), densidad logística por estado. Variables de demora histórica por ruta y categoría.',
    priority: 'medium', position: 13000, due_date: '2025-04-14T00:00:00.000Z',
  },
  {
    title: 'Entrenamiento XGBoost: predicción de días de demora',
    description: 'Modelo de regresión XGBoost con 50+ features. RMSE=2.3 días en test set. Hyperparams iniciales: n_estimators=500, max_depth=6, learning_rate=0.05, subsample=0.8.',
    priority: 'high', position: 14000, due_date: '2025-04-18T00:00:00.000Z',
  },
  {
    title: 'Evaluación modelo XGBoost: métricas y curvas',
    description: 'Calcular RMSE, MAE, R², ROC-AUC (versión clasificación is_late). Curvas de aprendizaje, importancia de features (top-20). Análisis de residuos por región y categoría.',
    priority: 'high', position: 15000, due_date: '2025-04-21T00:00:00.000Z',
  },
  {
    title: 'Análisis de sentimientos en reviews con BERT-pt',
    description: 'Fine-tuning de neuralmind/bert-base-portuguese-cased para clasificación 1-5 estrellas. F1-macro=0.79 en test. Embeddings de reviews almacenados en Supabase con halfvec(768).',
    priority: 'high', position: 16000, due_date: '2025-04-25T00:00:00.000Z',
  },
  {
    title: 'Pipeline de embeddings de reseñas con Voyage AI',
    description: 'Generar embeddings voyage-3-lite (512 dims) para todas las reseñas del dataset. Índice HNSW en pgvector para búsqueda semántica. Batch processing con rate limiting (21 req/s).',
    priority: 'medium', position: 17000, due_date: '2025-04-28T00:00:00.000Z',
  },
  {
    title: 'Setup de MLflow para tracking de experimentos',
    description: 'Configurar MLflow Tracking Server con backend PostgreSQL y artifact store en S3. Registrar todas las runs de XGBoost, LightGBM y BERT. Model registry con stages dev/staging/prod.',
    priority: 'medium', position: 18000, due_date: '2025-03-21T00:00:00.000Z',
  },
  {
    title: 'Versionado del dataset con DVC + remote S3',
    description: 'Inicializar DVC en el repositorio. Configurar remote en S3. Versionar los 9 CSV originales y las capas Bronze/Silver/Gold. Pipeline DVC con stages reproducibles (dvc repro).',
    priority: 'medium', position: 19000, due_date: '2025-03-17T00:00:00.000Z',
  },
  {
    title: 'Clustering de vendedores: volumen vs rating (DBSCAN)',
    description: 'Agrupar vendedores por volumen de pedidos, GMV y review_score usando DBSCAN (eps=0.3, min_samples=5). Identificar vendedores élite, problemáticos y nichos de alto margen.',
    priority: 'medium', position: 20000, due_date: '2025-04-04T00:00:00.000Z',
  },
  {
    title: 'Documentación del esquema Olist y decisiones ETL',
    description: 'Documentar en mkdocs: esquema de tablas, transformaciones aplicadas, criterios de limpieza, campos derivados y supuestos del modelo de negocio. Incluir diagrama ER interactivo.',
    priority: 'low', position: 21000, due_date: '2025-05-05T00:00:00.000Z',
  },
  {
    title: 'Configuración del entorno: conda env + requirements.txt',
    description: 'Crear environment.yml con Python 3.11, pandas, scikit-learn, xgboost, lightgbm, transformers, mlflow, dvc, streamlit, fastapi. Instrucciones de reproducción en README.md.',
    priority: 'low', position: 22000, due_date: '2025-03-07T00:00:00.000Z',
  },
]

const OLIST_IN_PROGRESS: Omit<SeedTask, 'status'>[] = [
  {
    title: 'Modelo de recomendación collaborative filtering (ALS)',
    description: 'Implementar Alternating Least Squares con implicit o PySpark. User-item matrix de clientes × categorías. Evaluar con Precision@10 y NDCG@10 usando split temporal.',
    priority: 'high', position: 1000, due_date: '2026-06-10T00:00:00.000Z',
  },
  {
    title: 'Dashboard Streamlit: mapa de ventas por estado BR',
    description: 'Visualizar GMV, volumen y review_score en mapa coroplético de Brasil con Folium/Plotly. Filtros por período y categoría. Tooltips con top-3 productos por estado.',
    priority: 'high', position: 2000, due_date: '2026-06-07T00:00:00.000Z',
  },
  {
    title: 'Pipeline de retraining mensual con Apache Airflow',
    description: 'DAG mensual: extrae datos nuevos → ETL Silver → feature engineering → reentrenamiento XGBoost → validación vs modelo en prod → push al Model Registry si mejora RMSE ≥ 2%.',
    priority: 'high', position: 3000, due_date: '2026-06-20T00:00:00.000Z',
  },
  {
    title: 'Forecasting de ventas 2026 con Prophet',
    description: 'Series temporales de GMV diario con Prophet. Incorporar seasonality brasileña (Carnaval, Black Friday, Navidad). Intervalos de confianza al 95%. Comparar contra SARIMA y LSTM.',
    priority: 'medium', position: 4000, due_date: '2026-06-14T00:00:00.000Z',
  },
  {
    title: 'Detección de anomalías en transacciones con Isolation Forest',
    description: 'Entrenar Isolation Forest (contamination=0.01) sobre features de pedidos: monto, hora, geolocalización, historial del cliente. Alertas en tiempo real vía endpoint FastAPI.',
    priority: 'high', position: 5000, due_date: '2026-06-17T00:00:00.000Z',
  },
  {
    title: 'API FastAPI para servir predicciones del modelo XGBoost',
    description: 'Endpoints POST /predict/delay y GET /recommend/{customer_id}. Autenticación JWT. Carga del modelo desde MLflow Model Registry. Validación de entrada con Pydantic v2.',
    priority: 'high', position: 6000, due_date: '2026-06-10T00:00:00.000Z',
  },
  {
    title: 'Optimización de hiperparámetros XGBoost con Optuna',
    description: '100 trials de búsqueda bayesiana: n_estimators (100-1000), max_depth (3-10), learning_rate (0.01-0.3), subsample (0.6-1.0). Objetivo: minimizar RMSE en CV 5-fold temporal.',
    priority: 'medium', position: 7000, due_date: '2026-06-07T00:00:00.000Z',
  },
  {
    title: 'Dashboard Streamlit: módulo de análisis de reseñas NLP',
    description: 'Nube de palabras por rating. Distribución de sentimientos por categoría y estado. Búsqueda semántica de reviews usando embeddings Voyage AI. Tendencias de topics por mes.',
    priority: 'medium', position: 8000, due_date: '2026-06-14T00:00:00.000Z',
  },
  {
    title: 'Informe ejecutivo automático con LLM (Groq/Llama)',
    description: 'Generar narrative automático de KPIs semanales usando Groq llama-3.3-70b. Input: métricas del DW. Output: análisis de tendencias, alertas y recomendaciones en español.',
    priority: 'high', position: 9000, due_date: '2026-06-17T00:00:00.000Z',
  },
  {
    title: 'Pruebas de integración del pipeline ETL end-to-end',
    description: 'Tests con pytest + testcontainers (PostgreSQL en Docker). Validar que cada stage Bronze→Silver→Gold produce el schema esperado. Cobertura ≥ 80% en funciones ETL críticas.',
    priority: 'medium', position: 10000, due_date: '2026-06-07T00:00:00.000Z',
  },
  {
    title: 'Análisis de cohortes de clientes 2016-2018',
    description: 'Cohort retention mensual: % de clientes que repiten en los 12 meses siguientes a su primera compra. Heatmap de retención. Comparar cohorts por estado y categoría inicial.',
    priority: 'medium', position: 11000, due_date: '2026-06-14T00:00:00.000Z',
  },
  {
    title: 'Modelo LightGBM: predicción de cancelación de pedidos',
    description: 'Clasificación binaria (is_cancelled). Features: historial del cliente, vendedor, logística, monto. Objetivo: F1 ≥ 0.80. SMOTE para balancear clases. Threshold calibración con Platt scaling.',
    priority: 'high', position: 12000, due_date: '2026-06-20T00:00:00.000Z',
  },
  {
    title: 'Monitoreo de concept drift con Evidently AI',
    description: 'Configurar EvidentlyAI para detectar data drift y model performance drift mensualmente. Dashboard HTML automático. Alertas en Slack cuando el PSI supere 0.2 en features críticos.',
    priority: 'medium', position: 13000, due_date: '2026-06-24T00:00:00.000Z',
  },
  {
    title: 'RAG sobre catálogo y descripciones de productos Olist',
    description: 'Indexar título, descripción y categoría de 33K productos con Voyage AI. Búsqueda semántica vía pgvector + reranking rerank-2-lite. Integrar en chat del dashboard Streamlit.',
    priority: 'high', position: 14000, due_date: '2026-06-20T00:00:00.000Z',
  },
  {
    title: 'Documentación técnica del pipeline ML (MkDocs)',
    description: 'Documentar arquitectura, decisiones de diseño, APIs y guía de desarrollo en MkDocs Material. Diagramas Mermaid para flujos de datos. Deploy automático en GitHub Pages.',
    priority: 'low', position: 15000, due_date: '2026-07-01T00:00:00.000Z',
  },
  {
    title: 'Validación cruzada 5-fold temporal y análisis de overfitting',
    description: 'Implementar TimeSeriesSplit (5 folds) para evitar data leakage. Comparar train vs validation curves. Detectar overfitting por región y categoría. Regularización con early_stopping.',
    priority: 'medium', position: 16000, due_date: '2026-06-14T00:00:00.000Z',
  },
  {
    title: 'Dashboard Streamlit: comparativo YoY top-10 categorías',
    description: 'Gráficos de barras apiladas y líneas para comparar 2017 vs 2018 por categoría: GMV, volumen, review_score. Filtro por región. Exportar a PNG y CSV desde el sidebar.',
    priority: 'medium', position: 17000, due_date: '2026-06-10T00:00:00.000Z',
  },
  {
    title: 'Contenerización del pipeline con Docker + Compose',
    description: 'Dockerfiles para: api FastAPI, scheduler Airflow, Streamlit dashboard. docker-compose.yml con PostgreSQL, Redis, MLflow Tracking Server. Configuración de redes y volúmenes.',
    priority: 'high', position: 18000, due_date: '2026-06-24T00:00:00.000Z',
  },
  {
    title: 'Segmentación geográfica de demanda para rutas logísticas',
    description: 'Clustering geoespacial de demanda con DBSCAN sobre lat/lng de clientes. Identificar zonas de alta densidad. Mapa interactivo con Folium. Recomendaciones de hubs logísticos.',
    priority: 'medium', position: 19000, due_date: '2026-06-17T00:00:00.000Z',
  },
  {
    title: 'Análisis de elasticidad de precio por categoría',
    description: 'Regresión log-log entre precio y volumen por categoría. Calcular elasticidad-precio propia. Identificar categorías inelásticas (margen) vs elásticas (volumen). Simulador de escenarios.',
    priority: 'medium', position: 20000, due_date: '2026-06-24T00:00:00.000Z',
  },
]

const OLIST_TODO: Omit<SeedTask, 'status'>[] = [
  {
    title: 'Deploy del modelo XGBoost a Vertex AI (Cloud Run)',
    description: 'Empaquetar modelo MLflow como contenedor Docker. Deploy en Google Cloud Run con auto-scaling. Endpoint HTTPS con autenticación IAM. Latencia objetivo < 200ms p99.',
    priority: 'high', position: 1000, due_date: '2026-07-15T00:00:00.000Z',
  },
  {
    title: 'A/B testing para el modelo de recomendación',
    description: 'Split 50/50 entre modelo ALS y baseline (best-seller por categoría). Métricas: CTR, conversión, revenue por sesión. Duración: 4 semanas. Análisis estadístico con bootstrap.',
    priority: 'high', position: 2000, due_date: '2026-07-22T00:00:00.000Z',
  },
  {
    title: 'Dashboard Streamlit: panel de predicción en tiempo real',
    description: 'Input: parámetros de un pedido hipotético. Output: días de entrega estimados, probabilidad de cancelación y productos recomendados. Integrado con la API FastAPI via requests.',
    priority: 'high', position: 3000, due_date: '2026-07-08T00:00:00.000Z',
  },
  {
    title: 'Grafo de conocimiento de productos con NetworkX + Neo4j',
    description: 'Construir grafo donde nodos=productos y aristas=co-compra. Calcular centralidad, comunidades (Louvain) y productos puente. Visualización interactiva con PyVis.',
    priority: 'medium', position: 4000, due_date: '2026-07-29T00:00:00.000Z',
  },
  {
    title: 'Fine-tuning LLM para clasificación de categorías Olist',
    description: 'LoRA fine-tuning de Llama-3.1-8B sobre pares (descripción_producto → categoría). Dataset: 30K ejemplos. Evaluación: accuracy top-1 y top-5. Deploy en Ollama local y Groq.',
    priority: 'high', position: 5000, due_date: '2026-08-05T00:00:00.000Z',
  },
  {
    title: 'Pipeline de streaming con Kafka + Spark Structured',
    description: 'Producir eventos de pedido en tiempo real a Kafka. Consumir con Spark Structured Streaming: agregaciones en ventana de 5 min. Detectar anomalías on-the-fly. Sink a PostgreSQL.',
    priority: 'medium', position: 6000, due_date: '2026-08-12T00:00:00.000Z',
  },
  {
    title: 'Análisis causal: impacto de reviews en pedidos futuros',
    description: 'Usar DoWhy para estimar el efecto causal de review_score en la probabilidad de recompra. Controlar por confounders: precio, categoría, región. Refutation tests para validez.',
    priority: 'medium', position: 7000, due_date: '2026-07-29T00:00:00.000Z',
  },
  {
    title: 'Pruebas de carga para la API FastAPI (Locust)',
    description: 'Simular 500 usuarios concurrentes en endpoint /predict/delay. Objetivo: throughput ≥ 200 RPS, latencia p95 < 500ms. Identificar bottlenecks y optimizar caché Redis.',
    priority: 'medium', position: 8000, due_date: '2026-07-15T00:00:00.000Z',
  },
  {
    title: 'SHAP para explicabilidad del modelo XGBoost',
    description: 'Calcular SHAP values globales (feature importance) y locales (explicación por pedido). Plots: beeswarm, waterfall, dependency. Integrar explicaciones en la respuesta de la API.',
    priority: 'high', position: 9000, due_date: '2026-07-08T00:00:00.000Z',
  },
  {
    title: 'Reporte ejecutivo PDF automático con LLM + jsPDF',
    description: 'Generar PDF semanal con: KPIs actualizados, gráficos PNG, análisis narrativo del LLM y alertas de anomalías. Programado con cron. Enviar por email con Resend API.',
    priority: 'medium', position: 10000, due_date: '2026-07-15T00:00:00.000Z',
  },
  {
    title: 'Pipeline incremental de ingesta de datos nuevos (daily)',
    description: 'Detectar nuevos CSV o registros en S3 (basado en timestamp). Ejecutar ETL Bronze→Silver→Gold solo sobre incrementos. Idempotente: safe para re-run. Logs en CloudWatch.',
    priority: 'medium', position: 11000, due_date: '2026-07-22T00:00:00.000Z',
  },
  {
    title: 'Evaluación de fairness y sesgos en modelos (Fairlearn)',
    description: 'Medir disparidad de RMSE del modelo de demora por región (N vs SE). Aplicar mitigación con GridSearch de Fairlearn. Documentar trade-off entre fairness y accuracy global.',
    priority: 'high', position: 12000, due_date: '2026-07-29T00:00:00.000Z',
  },
  {
    title: 'Integración con Power BI vía conector REST custom',
    description: 'Crear conector Power BI que consulte la API FastAPI para traer KPIs y predicciones. Autenticación OAuth2. Refresh automático cada hora. Publicar en Power BI Service.',
    priority: 'low', position: 13000, due_date: '2026-08-19T00:00:00.000Z',
  },
  {
    title: 'Validación del modelo con dataset hold-out 2018 Q4',
    description: 'Evaluar modelo XGBoost y LightGBM en datos de Q4 2018 (nunca vistos en train). Comparar degradación de RMSE. Análisis de error por categoría, región y valor del pedido.',
    priority: 'high', position: 14000, due_date: '2026-07-08T00:00:00.000Z',
  },
  {
    title: 'Publicación del notebook final con Quarto (GitHub Pages)',
    description: 'Convertir notebooks Jupyter a Quarto. Renderizar HTML con código, outputs y narrativa. Deploy automático en GitHub Pages desde main branch. DOI con Zenodo para citar.',
    priority: 'low', position: 15000, due_date: '2026-08-26T00:00:00.000Z',
  },
  {
    title: 'Caché de predicciones con Redis para la API FastAPI',
    description: 'Cachear respuestas de /predict/delay con Redis TTL=1h. Invalidación por re-entrenamiento del modelo. Medir mejora de latencia: baseline 80ms → objetivo 5ms en cache hit.',
    priority: 'medium', position: 16000, due_date: '2026-07-15T00:00:00.000Z',
  },
  {
    title: 'Dashboard Streamlit: simulador de escenarios what-if',
    description: 'Sliders para ajustar: precio, categoría, región de destino, fecha estimada. El simulador muestra en tiempo real cambios en: demanda predicha, demora estimada, probabilidad de cancelación.',
    priority: 'high', position: 17000, due_date: '2026-07-22T00:00:00.000Z',
  },
  {
    title: 'Análisis de red de vendedores con graph analytics',
    description: 'Grafo de vendedores conectados por categorías compartidas. Centralidad de grado y betweenness. Detectar vendedores dominantes por categoría. Visualizar con Gephi + NetworkX.',
    priority: 'low', position: 18000, due_date: '2026-08-05T00:00:00.000Z',
  },
  {
    title: 'Modelo de estimación de tiempo de entrega en tiempo real',
    description: 'Modelo online (River ML) que aprende incrementalmente de nuevos pedidos. Integrar en la API FastAPI como segunda opinión al XGBoost batch. Comparar RMSE rolling por semana.',
    priority: 'high', position: 19000, due_date: '2026-07-29T00:00:00.000Z',
  },
  {
    title: 'Presentación final de resultados y cierre del proyecto',
    description: 'Preparar slides ejecutivos (15 min): objetivos, metodología, resultados cuantitativos, demo en vivo del dashboard Streamlit. Documento de lecciones aprendidas y próximos pasos.',
    priority: 'medium', position: 20000, due_date: '2026-09-01T00:00:00.000Z',
  },
]

export async function seedOlistTasks(
  projectId?: string | null
): Promise<ActionResult<{ count: number }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  const rows = [
    ...OLIST_DONE.map(t => ({ ...t, status: 'done' as const, user_id: user.id, ...(projectId ? { project_id: projectId } : {}) })),
    ...OLIST_IN_PROGRESS.map(t => ({ ...t, status: 'in_progress' as const, user_id: user.id, ...(projectId ? { project_id: projectId } : {}) })),
    ...OLIST_TODO.map(t => ({ ...t, status: 'todo' as const, user_id: user.id, ...(projectId ? { project_id: projectId } : {}) })),
  ]

  const { data, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select('id, title, description')

  if (error) return { success: false, error: error.message }

  // Generar embeddings en paralelo (fire-and-forget); respeta ratelimit de embed (100/min)
  for (const task of data ?? []) {
    void triggerEmbeddingLocal(task.id, task.title, task.description)
  }

  revalidatePath('/board')
  return { success: true, data: { count: data?.length ?? 0 } }
}

export async function deleteAllTasks(
  projectId?: string | null
): Promise<ActionResult<void>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  // Eliminar con el mismo filtro que usa el board: por proyecto si hay uno activo,
  // por usuario si no. Los embeddings se eliminan en cascada (ON DELETE CASCADE).
  let query = supabase.from('tasks').delete().eq('user_id', user.id)
  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { error } = await query
  if (error) return { success: false, error: error.message }

  revalidatePath('/board')
  return { success: true, data: undefined }
}
