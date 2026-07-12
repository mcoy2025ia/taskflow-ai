import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// User IDs
const users = {
  owner: "38bd6ec2-28e8-4f52-86c7-e7e2a61bd94c", // María Coy
  dataEngineer: "d9d36f55-c29e-4ac8-85c6-f0c71ad0d9ca", // Demo User 1
  mlEngineer: "cda4d105-c495-4f6f-a567-ae89c3f98923", // Demo User 2
};

interface TaskDetail {
  role: "Data Engineer" | "ML Engineer" | "Data Analyst" | "Business Analyst" | "Scrum Master";
  title: string;
  description: string;
  phase: number;
  phaseLabel: string;
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  completedHours: number;
  priority: "low" | "medium" | "high";
  status: "done" | "in_progress" | "todo";
  assignee: string; // email
}

// Calculate completed hours based on current date (11 julho 2026 = 95% complete)
const currentDate = new Date("2026-07-11");

function getCompletionStatus(
  taskStart: Date,
  taskEnd: Date,
  estimatedHours: number
): { status: "done" | "in_progress" | "todo"; completedHours: number } {
  if (taskEnd <= currentDate) {
    return { status: "done", completedHours: estimatedHours };
  }
  if (taskStart <= currentDate && currentDate < taskEnd) {
    const taskDuration = taskEnd.getTime() - taskStart.getTime();
    const completedDuration = currentDate.getTime() - taskStart.getTime();
    const completionRatio = completedDuration / taskDuration;
    return {
      status: "in_progress",
      completedHours: Math.round(estimatedHours * completionRatio),
    };
  }
  return { status: "todo", completedHours: 0 };
}

// Comprehensive Olist project tasks
const olistTasks: TaskDetail[] = [
  // Phase 1: Analysis & Planning (Feb 1-28, 2026)
  {
    role: "Business Analyst",
    title: "[PHASE 1.1] Análisis de caso de negocio Olist - Contexto",
    description:
      "Estudio del dataset de Kaggle: entender marketplace de e-commerce brasileño, KPIs, y objetivos",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-01"),
    endDate: new Date("2026-02-05"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 1.2] Definir roadmap y sprints",
    description:
      "Crear estructura de 6 fases, sprints semanales, definir capacidad del equipo",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-01"),
    endDate: new Date("2026-02-07"),
    estimatedHours: 12,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 1.3] Exploración inicial de datos",
    description:
      "EDA: estructura, calidad, valores faltantes, distribuciones, correlaciones",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-03"),
    endDate: new Date("2026-02-10"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 1.4] Definir KPIs y métricas clave",
    description:
      "Customer lifetime value, churn, NPS, satisfacción, revenue por categoría, etc.",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-05"),
    endDate: new Date("2026-02-12"),
    estimatedHours: 12,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 1.5] Diseñar arquitectura Medallion",
    description:
      "Definir capas Bronze, Silver, Gold en AWS/GCP/Snowflake, lineage, particiones",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-05"),
    endDate: new Date("2026-02-14"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "ML Engineer",
    title: "[PHASE 1.6] Definir problemas ML y features",
    description:
      "Churn prediction, product recommendation, demand forecasting, fraud detection",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-08"),
    endDate: new Date("2026-02-15"),
    estimatedHours: 14,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 1.7] Review semanal Sprint 1",
    description: "Retrospectiva, burndown, ajuste de capacidad",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-14"),
    endDate: new Date("2026-02-15"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 1.8] Setup infraestructura y repositorio",
    description: "Git repo, CI/CD, data lakes, notebooks, documentación",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-10"),
    endDate: new Date("2026-02-18"),
    estimatedHours: 18,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 1.9] Documento de requerimientos",
    description: "PRD completo: objetivos, scope, constraints, success criteria",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-12"),
    endDate: new Date("2026-02-22"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 1.10] Review semanal Sprint 2",
    description: "Retrospectiva, burndown, ajuste de capacidad",
    phase: 1,
    phaseLabel: "Análisis & Planning",
    startDate: new Date("2026-02-21"),
    endDate: new Date("2026-02-22"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },

  // Phase 2: Bronze Layer & Data Ingestion (Mar 1-31, 2026)
  {
    role: "Data Engineer",
    title: "[PHASE 2.1] Ingerir tablas raw en Bronze",
    description:
      "orders, customers, products, sellers, payments, reviews - directamente del CSV",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-01"),
    endDate: new Date("2026-03-08"),
    estimatedHours: 24,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 2.2] Implementar schema registry y lineage",
    description: "Tracking de origen de datos, versionado, metadatos",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-03"),
    endDate: new Date("2026-03-10"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 2.3] Validación calidad datos Bronze",
    description: "Controles de duplicados, valores nulos, rangos, referencias",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-05"),
    endDate: new Date("2026-03-12"),
    estimatedHours: 18,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 2.4] Implementar transformaciones básicas",
    description: "Parsing de fechas, tipos de datos, normalizaciones simples",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-08"),
    endDate: new Date("2026-03-15"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 2.5] Análisis de cobertura temporal",
    description: "Fechas mín/máx, gaps, seasonality patterns",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-10"),
    endDate: new Date("2026-03-17"),
    estimatedHours: 12,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 2.6] Review semanal Sprint 3",
    description: "Retrospectiva, burndown, identificar blockers",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-07"),
    endDate: new Date("2026-03-08"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 2.7] Review semanal Sprint 4",
    description: "Retrospectiva, burndown",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-14"),
    endDate: new Date("2026-03-15"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 2.8] Validación de datos vs requerimientos",
    description: "Completitud de KPIs, consistencia con negocio",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-12"),
    endDate: new Date("2026-03-19"),
    estimatedHours: 10,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 2.9] Documentar pipelines Bronze",
    description: "DAGs, SLAs, alertas, runbooks",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-18"),
    endDate: new Date("2026-03-25"),
    estimatedHours: 12,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 2.10] Review semanal Sprint 5",
    description: "Retrospectiva, capacidad planning",
    phase: 2,
    phaseLabel: "Bronze & Ingesta",
    startDate: new Date("2026-03-21"),
    endDate: new Date("2026-03-22"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },

  // Phase 3: Silver Layer & Transformations (Apr 1-30, 2026)
  {
    role: "Data Engineer",
    title: "[PHASE 3.1] Crear tablas Silver - Dimensiones",
    description: "dim_customers, dim_sellers, dim_products, dim_dates con SCD Type 2",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-04-08"),
    estimatedHours: 28,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 3.2] Crear tablas Silver - Hechos",
    description: "fact_orders, fact_reviews, fact_payments con agregaciones",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-04-10"),
    estimatedHours: 32,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 3.3] Validación de integridad referencial Silver",
    description: "FK checks, aggregations validation, row counts reconciliation",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-05"),
    endDate: new Date("2026-04-12"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 3.4] Implementar enriquecimientos Silver",
    description: "Cálculos: AUM, churn markers, RFM, product afinity",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-08"),
    endDate: new Date("2026-04-18"),
    estimatedHours: 24,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 3.5] Análisis exploratorio Silver",
    description: "Distribuciones, outliers, segmentación de clientes",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-10"),
    endDate: new Date("2026-04-18"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 3.6] Review semanal Sprint 6",
    description: "Retrospectiva, velocidad, planning",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-04"),
    endDate: new Date("2026-04-05"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "ML Engineer",
    title: "[PHASE 3.7] Feature engineering exploratorio",
    description: "Crear features temporales, comportamentales, contextuales",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-12"),
    endDate: new Date("2026-04-22"),
    estimatedHours: 26,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 3.8] Review semanal Sprint 7",
    description: "Retrospectiva, ajuste de capacidad",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-11"),
    endDate: new Date("2026-04-12"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 3.9] Validar Silver vs KPIs definidos",
    description: "Reconciliación de métricas vs requerimientos de negocio",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-15"),
    endDate: new Date("2026-04-22"),
    estimatedHours: 12,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 3.10] Review semanal Sprint 8",
    description: "Retrospectiva final fase Silver",
    phase: 3,
    phaseLabel: "Silver & Transformación",
    startDate: new Date("2026-04-18"),
    endDate: new Date("2026-04-19"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },

  // Phase 4: Gold Layer & Analytics (May 1-31, 2026)
  {
    role: "Data Engineer",
    title: "[PHASE 4.1] Crear datamart Gold - Ventas",
    description: "Agregaciones diarias, semanales, mensuales por categoría, región",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-08"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 4.2] Crear datamart Gold - Clientes",
    description: "Segmentación, lifetime value, churn score, engagement",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-03"),
    endDate: new Date("2026-05-10"),
    estimatedHours: 22,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 4.3] Crear datamart Gold - Productos",
    description: "Top sellers, ratings, reviews sentiment, demand curves",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-05"),
    endDate: new Date("2026-05-12"),
    estimatedHours: 18,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 4.4] Análisis de tendencias y anomalías",
    description: "Seasonal decomposition, trend analysis, outlier detection",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-08"),
    endDate: new Date("2026-05-16"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 4.5] Review semanal Sprint 9",
    description: "Retrospectiva, velocidad de Gold layer",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-02"),
    endDate: new Date("2026-05-03"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 4.6] Análisis financiero y ROI",
    description: "Márgenes por categoría, payback period, customer acquisition cost",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-18"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 4.7] Benchmarking y comparativas",
    description: "Market comparison, peer analysis, performance vs targets",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-12"),
    endDate: new Date("2026-05-20"),
    estimatedHours: 14,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 4.8] Review semanal Sprint 10",
    description: "Retrospectiva, capacidad planning",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-09"),
    endDate: new Date("2026-05-10"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 4.9] Optimizar índices y particiones Gold",
    description: "Query performance tuning, materialized views",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-15"),
    endDate: new Date("2026-05-23"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 4.10] Review semanal Sprint 11",
    description: "Retrospectiva final Gold layer",
    phase: 4,
    phaseLabel: "Gold & Analytics",
    startDate: new Date("2026-05-16"),
    endDate: new Date("2026-05-17"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },

  // Phase 5: ML Models (Jun 1-30, 2026)
  {
    role: "ML Engineer",
    title: "[PHASE 5.1] Churn prediction - EDA y features",
    description: "Feature selection, temporal aggregations, target definition",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-10"),
    estimatedHours: 28,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "ML Engineer",
    title: "[PHASE 5.2] Churn prediction - Entrenamiento y tuning",
    description: "Modelos: LR, RF, XGBoost, tuning de hiperparámetros",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-08"),
    endDate: new Date("2026-06-16"),
    estimatedHours: 32,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "ML Engineer",
    title: "[PHASE 5.3] Product recommendation - Collaborative filtering",
    description: "User-user, item-item, matrix factorization (SVD, ALS)",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-10"),
    endDate: new Date("2026-06-20"),
    estimatedHours: 30,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "ML Engineer",
    title: "[PHASE 5.4] Demand forecasting - Time series",
    description: "ARIMA, Prophet, LSTM para predecir demanda por categoría",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-15"),
    endDate: new Date("2026-06-25"),
    estimatedHours: 28,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "demo2@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 5.5] Validación y evaluación de modelos",
    description: "Cross-validation, metrics (AUC, RMSE, MAP), backtesting",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-12"),
    endDate: new Date("2026-06-22"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 5.6] Review semanal Sprint 12",
    description: "Retrospectiva, velocidad ML",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-05"),
    endDate: new Date("2026-06-06"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "ML Engineer",
    title: "[PHASE 5.7] Fraud detection - Anomaly detection",
    description: "Isolation Forest, LOF, One-Class SVM para transacciones sospechosas",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-18"),
    endDate: new Date("2026-06-26"),
    estimatedHours: 24,
    completedHours: 0,
    priority: "medium",
    status: "in_progress",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 5.8] Review semanal Sprint 13",
    description: "Retrospectiva, planning próxima fase",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-12"),
    endDate: new Date("2026-06-13"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 5.9] MLOps - Versionado de modelos",
    description: "Model registry, experiment tracking, reproducibilidad",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-20"),
    endDate: new Date("2026-06-28"),
    estimatedHours: 18,
    completedHours: 0,
    priority: "high",
    status: "in_progress",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 5.10] Review semanal Sprint 14",
    description: "Retrospectiva final modelos ML",
    phase: 5,
    phaseLabel: "ML & Modelos",
    startDate: new Date("2026-06-19"),
    endDate: new Date("2026-06-20"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },

  // Phase 6: Reporting & Dashboards (Jul 1-25, 2026)
  {
    role: "Data Analyst",
    title: "[PHASE 6.1] Dashboard ejecutivo - Overview",
    description: "KPIs clave, trends, top sellers, customer segments",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-01"),
    endDate: new Date("2026-07-08"),
    estimatedHours: 24,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 6.2] Dashboard operacional - Sellers",
    description: "Performance por seller, ratings, delivery times, revenue",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-02"),
    endDate: new Date("2026-07-09"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 6.3] Dashboard de clientes - RFM",
    description: "Segmentación, lifetime value, churn risk, engagement",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-03"),
    endDate: new Date("2026-07-10"),
    estimatedHours: 22,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Data Analyst",
    title: "[PHASE 6.4] Dashboard de productos - Análisis",
    description: "Top products, categories, reviews, demand forecast",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-04"),
    endDate: new Date("2026-07-11"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "demo1@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 6.5] Review semanal Sprint 15",
    description: "Retrospectiva, capacidad final",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-03"),
    endDate: new Date("2026-07-04"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 6.6] Reportes ejecutivos - Mensual",
    description: "Executive summary, insights, recommendations, next steps",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-06"),
    endDate: new Date("2026-07-14"),
    estimatedHours: 16,
    completedHours: 0,
    priority: "high",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Business Analyst",
    title: "[PHASE 6.7] Análisis de impacto de recomendaciones",
    description: "ROI predicho de churn reduction, recommendations, fraud prevention",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-08"),
    endDate: new Date("2026-07-15"),
    estimatedHours: 14,
    completedHours: 0,
    priority: "medium",
    status: "done",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 6.8] Review semanal Sprint 16",
    description: "Retrospectiva, ajustes finales",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-10"),
    endDate: new Date("2026-07-11"),
    estimatedHours: 4,
    completedHours: 0,
    priority: "medium",
    status: "in_progress",
    assignee: "mcoyllmdata@gmail.com",
  },
  {
    role: "Data Engineer",
    title: "[PHASE 6.9] Documentación final y conocimiento",
    description: "Runbooks, troubleshooting, data dictionary, API documentation",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-12"),
    endDate: new Date("2026-07-20"),
    estimatedHours: 20,
    completedHours: 0,
    priority: "medium",
    status: "in_progress",
    assignee: "demo2@example.com",
  },
  {
    role: "Scrum Master",
    title: "[PHASE 6.10] Review final y cierre de proyecto",
    description: "Retrospectiva final, lecciones aprendidas, celebración",
    phase: 6,
    phaseLabel: "Reportes & Dashboards",
    startDate: new Date("2026-07-24"),
    endDate: new Date("2026-07-25"),
    estimatedHours: 6,
    completedHours: 0,
    priority: "high",
    status: "todo",
    assignee: "mcoyllmdata@gmail.com",
  },
];

async function seedOlistProject() {
  console.log("🌱 Creating Olist project with 60+ tasks...\n");

  try {
    // Create main project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: users.owner,
        name: "Olist E-commerce Analytics & ML - Kaggle Case",
        start_date: "2026-02-01",
        delivery_date: "2026-07-25",
      })
      .select()
      .single();

    if (projectError) throw projectError;

    console.log(`✅ Project created: ${project.id}\n`);

    // Add team members
    const { error: membersError } = await supabase
      .from("project_members")
      .insert([
        { project_id: project.id, user_id: users.owner, role: "owner" },
        {
          project_id: project.id,
          user_id: users.dataEngineer,
          role: "editor",
        },
        { project_id: project.id, user_id: users.mlEngineer, role: "editor" },
      ]);

    if (membersError) throw membersError;

    console.log("✅ Team members added\n");

    // Assign tasks to users
    const userMap: { [key: string]: string } = {
      "mcoyllmdata@gmail.com": users.owner,
      "demo1@example.com": users.dataEngineer,
      "demo2@example.com": users.mlEngineer,
    };

    // Insert tasks
    let createdTasks = 0;
    for (const task of olistTasks) {
      const { status, completedHours } = getCompletionStatus(
        task.startDate,
        task.endDate,
        task.estimatedHours
      );

      const taskUser = userMap[task.assignee];

      const { error: taskError } = await supabase.from("tasks").insert({
        user_id: taskUser,
        project_id: project.id,
        title: task.title,
        description: `[${task.role}] ${task.description}\n\n📅 Phase ${task.phase}: ${task.phaseLabel}\n⏱️ Estimated: ${task.estimatedHours}h | Completed: ${completedHours}h\n🎯 ${task.priority.toUpperCase()} PRIORITY`,
        status,
        priority: task.priority,
        position: createdTasks * 1000,
        due_date: task.endDate.toISOString(),
      });

      if (taskError) {
        console.error(`❌ Error creating task: ${task.title}`, taskError);
      } else {
        createdTasks++;
      }
    }

    console.log(`✅ ${createdTasks} tasks created\n`);

    // Summary
    const totalEstimatedHours = olistTasks.reduce(
      (sum, t) => sum + t.estimatedHours,
      0
    );
    const completedTasks = olistTasks.filter((t) => {
      const { status } = getCompletionStatus(t.startDate, t.endDate, t.estimatedHours);
      return status === "done";
    }).length;
    const inProgressTasks = olistTasks.filter((t) => {
      const { status } = getCompletionStatus(t.startDate, t.endDate, t.estimatedHours);
      return status === "in_progress";
    }).length;

    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ OLIST PROJECT SEEDED SUCCESSFULLY");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📊 Total Tasks:        ${olistTasks.length}`);
    console.log(`✅ Completed:          ${completedTasks} (${Math.round((completedTasks / olistTasks.length) * 100)}%)`);
    console.log(
      `⏳ In Progress:        ${inProgressTasks} (${Math.round((inProgressTasks / olistTasks.length) * 100)}%)`
    );
    console.log(
      `⏹️  Todo:               ${olistTasks.length - completedTasks - inProgressTasks}`
    );
    console.log(`⏱️  Total Est. Hours:   ${totalEstimatedHours}h`);
    console.log(`📅 Timeline:           Feb 1 - Jul 25, 2026 (176 days)`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log("\n🎯 PROJECT BREAKDOWN:\n");

    const phaseGroups = olistTasks.reduce(
      (acc, t) => {
        if (!acc[t.phase]) {
          acc[t.phase] = { label: t.phaseLabel, tasks: [] };
        }
        acc[t.phase].tasks.push(t);
        return acc;
      },
      {} as Record<number, { label: string; tasks: TaskDetail[] }>
    );

    for (const phaseNum of Object.keys(phaseGroups)) {
      const phase = phaseGroups[Number(phaseNum)];
      const phaseTasks = phase.tasks;
      const phaseCompleted = phaseTasks.filter((t) => {
        const { status } = getCompletionStatus(t.startDate, t.endDate, t.estimatedHours);
        return status === "done";
      }).length;
      const phaseHours = phaseTasks.reduce((sum, t) => sum + t.estimatedHours, 0);

      console.log(`PHASE ${phaseNum}: ${phase.label}`);
      console.log(`  Tasks: ${phaseTasks.length} | Completed: ${phaseCompleted} | Hours: ${phaseHours}h`);
      phaseTasks.forEach((t) => {
        const { status } = getCompletionStatus(t.startDate, t.endDate, t.estimatedHours);
        const statusIcon =
          status === "done" ? "✅" : status === "in_progress" ? "⏳" : "⏹️";
        console.log(`  ${statusIcon} [${t.role}] ${t.title}`);
      });
      console.log("");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("👥 TEAM ROLES:");
    console.log("───────────────────────────────────────────────────────────");
    console.log("📊 Data Analyst:       demo1@example.com");
    console.log("🛠️  Data Engineer:      demo2@example.com");
    console.log("🤖 ML Engineer:        demo2@example.com");
    console.log("💼 Business Analyst:   mcoyllmdata@gmail.com");
    console.log("🏃 Scrum Master:       mcoyllmdata@gmail.com");
    console.log("═══════════════════════════════════════════════════════════\n");
  } catch (error) {
    console.error("❌ Error seeding Olist project:", error);
  }
}

seedOlistProject().catch(console.error);
