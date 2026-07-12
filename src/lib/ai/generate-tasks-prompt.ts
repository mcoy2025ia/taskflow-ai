export const DEFAULT_GENERATE_TASKS_PROMPT = `Actúa como un Ingeniero de Datos Senior y MLOps Tech Lead. Genera un dataset sintético en formato CSV (usando coma ',' como separador) con exactamente 90 tareas para simular el backlog de un proyecto real de Arquitectura Medallion y Machine Learning en producción.

Esquema obligatorio (primera fila = encabezados):
title,description,status,priority,due_date

Reglas por columna:
- title: texto descriptivo, máx 180 caracteres, sin comas internas
- description: contexto técnico conciso (1-2 oraciones), máx 250 caracteres, sin comas internas ni saltos de línea
- status: solo 'todo', 'in_progress' o 'done'
- priority: solo 'low', 'medium' o 'high'
- due_date: formato YYYY-MM-DD

Restricciones temporales:
- Fecha de inicio: 2026-02-15. Fecha corte: 2026-06-11.
- Exactamente 81 tareas (1-81) con status 'done' y fechas entre 2026-02-15 y 2026-06-05.
- Exactamente 9 tareas (82-90) con status 'in_progress' o 'todo' y due_date > 2026-06-11.

Distribución técnica:
- Tareas 1-20: Fase Bronze (ingesta cruda, conectores, deduplicación, MLflow setup)
- Tareas 21-40: Fase Silver (schema enforcement, limpieza, Great Expectations)
- Tareas 41-55: Fase Gold (KPIs, Data Marts, particiones)
- Tareas 56-70: Feature Engineering / MLOps (normalización, Feature Store)
- Tareas 71-81: Model Training (XGBoost/RF, MLflow, ROC/AUC)
- Tareas 82-90: Despliegue y Monitoreo (FastAPI, Docker, Evidently AI)

IMPORTANTE: Devuelve SOLO el contenido CSV, sin bloques de código, sin explicaciones, sin texto adicional. La primera línea debe ser exactamente: title,description,status,priority,due_date`
