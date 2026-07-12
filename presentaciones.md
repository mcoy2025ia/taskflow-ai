# TaskFlow v3 — Presentación Ejecutiva · Especificación de 12 láminas para generación con IA

> **Herramientas objetivo:** Gemini (Imagen) o ChatGPT (GPT-4o image).
> **Uso:** copia el prompt de cada lámina tal cual. Cada prompt es autocontenido (incluye el estilo).
> **Si el texto sale con errores ortográficos:** regenera indicando "render the Spanish text EXACTLY as written, letter by letter". Con textos largos, genera en la resolución más alta disponible.

---

## 🎨 Estilo maestro (referencia — ya está embebido en cada prompt)

- **Fondo:** blanco puro / gris humo muy claro (#F7F9FB)
- **Colores:** azul marino profundo #051C2C (títulos), azul eléctrico #2251FF (acentos, cifras, líneas), gris #6B7280 (texto secundario), verde esmeralda #10B981 solo para "resuelto/positivo", rojo ladrillo #C0392B solo para incidentes
- **Tipografía:** sans-serif corporativa limpia (estilo Helvetica/Inter), títulos en bold, cuerpo regular
- **Layout:** kicker superior en mayúsculas pequeñas, línea horizontal fina azul bajo el título, franja inferior gris claro con el "So what"
- **Estética:** informe McKinsey/BCG — vectorial plano, sin sombras 3D, sin fotos stock, sin robots ni cerebros, máxima legibilidad
- **Formato:** 16:9, apto para proyección

---

# DIAPOSITIVA 1 — Portada

## 📝 Texto en la lámina

| Elemento | Contenido exacto |
|---|---|
| Kicker (sup. izq.) | `MCOY AI + DATA STRATEGY · DATAPATH BOOTCAMP` |
| Título | `TaskFlow v3` |
| Mensaje de acción | `La gestión de proyectos de datos deja de ser un tablero pasivo y se convierte en un agente que ejecuta.` |
| Subtítulo | `Plataforma SaaS multi-tenant con IA nativa: Kanban colaborativo en tiempo real · Agente RAG con tool calling · Analítica ejecutiva generada por LLM` |
| Pie (inf. izq.) | `Next.js 16 · Supabase · DeepSeek · Voyage AI — Julio 2026` |

## 🎨 Dirección visual
Portada editorial: mitad izquierda con todo el texto en azul marino sobre blanco; mitad derecha con gráfico vectorial abstracto — tres columnas Kanban minimalistas (rectángulos de contorno azul) cuyas tarjetas se conectan con líneas azul eléctrico hacia un nodo circular verde (el agente). Aire generoso, una sola línea azul eléctrico horizontal separando título de subtítulo.

## 🤖 Prompt

> Corporate consulting presentation cover slide, 16:9, clean white background. Left half: text block in deep navy blue (#051C2C) — small uppercase kicker at top "MCOY AI + DATA STRATEGY · DATAPATH BOOTCAMP", then huge bold headline "TaskFlow v3", below it a thin electric blue (#2251FF) horizontal rule, then medium headline "La gestión de proyectos de datos deja de ser un tablero pasivo y se convierte en un agente que ejecuta.", then smaller gray subtitle "Plataforma SaaS multi-tenant con IA nativa: Kanban colaborativo en tiempo real · Agente RAG con tool calling · Analítica ejecutiva generada por LLM", tiny footer bottom left "Next.js 16 · Supabase · DeepSeek · Voyage AI — Julio 2026". Right half: minimal flat vector illustration — three outlined kanban columns with small cards, thin electric blue connector lines flowing from the cards into one single emerald green circular node on the far right. McKinsey editorial style, flat vector, no shadows, no photos, no robots. Render all Spanish text exactly as written.

---

# DIAPOSITIVA 2 — Resumen ejecutivo

## 📝 Texto en la lámina

**Kicker:** `RESUMEN EJECUTIVO`

**Título:** `Tres mensajes: producto completo, IA con guardrails de producción y resiliencia probada con incidentes reales`

**Bloque 1 — `01 · PRODUCTO COMPLETO, NO PROTOTIPO`**
`12 tablas con Row Level Security · 13 migraciones idempotentes · 6 herramientas de agente · CI/CD con 5 compuertas de calidad · presupuestos Lighthouse (LCP < 2.5s)`

**Bloque 2 — `02 · LA IA EJECUTA, NO SOLO CONVERSA`**
`El agente crea, mueve y elimina tareas en lenguaje natural sobre un pipeline RAG híbrido (intención + vectorial + reranking). Toda acción destructiva exige confirmación explícita del usuario.`

**Bloque 3 — `03 · OPERACIÓN VALIDADA BAJO FUEGO`**
`4 incidentes reales de producción resueltos con patrones reutilizables, incluida una migración de proveedor LLM en ~1 hora sin tocar el parser del agente.`

**Franja inferior:** `So what: el diferencial no es "usar IA" — es haberla llevado a producción con seguridad, costos y fallos controlados.`

## 🎨 Dirección visual
Tres tarjetas verticales iguales lado a lado, cada una con número grande en azul eléctrico (01/02/03), título en navy bold y texto de soporte en gris. Franja "So what" a todo lo ancho abajo en gris claro.

## 🤖 Prompt

> Corporate consulting slide, 16:9, white background, McKinsey style flat vector. Top: small uppercase gray kicker "RESUMEN EJECUTIVO", bold navy (#051C2C) action title "Tres mensajes: producto completo, IA con guardrails de producción y resiliencia probada con incidentes reales", thin electric blue rule below. Body: three equal white cards side by side with light gray borders. Card 1: giant electric blue number "01", bold navy heading "PRODUCTO COMPLETO, NO PROTOTIPO", gray body text "12 tablas con Row Level Security · 13 migraciones idempotentes · 6 herramientas de agente · CI/CD con 5 compuertas de calidad · presupuestos Lighthouse (LCP < 2.5s)". Card 2: number "02", heading "LA IA EJECUTA, NO SOLO CONVERSA", body "El agente crea, mueve y elimina tareas en lenguaje natural sobre un pipeline RAG híbrido (intención + vectorial + reranking). Toda acción destructiva exige confirmación explícita del usuario.". Card 3: number "03", heading "OPERACIÓN VALIDADA BAJO FUEGO", body "4 incidentes reales de producción resueltos con patrones reutilizables, incluida una migración de proveedor LLM en ~1 hora sin tocar el parser del agente.". Bottom full-width light gray strip with navy text: "So what: el diferencial no es usar IA — es haberla llevado a producción con seguridad, costos y fallos controlados." Render all Spanish text exactly as written. Flat, clean, high legibility.

---

# DIAPOSITIVA 3 — Contexto y problema

## 📝 Texto en la lámina

**Kicker:** `CONTEXTO Y PROBLEMA`

**Título:** `Los equipos de datos pierden 20–30% de su capacidad en coordinación que ninguna herramienta genérica resuelve`

**Cifra destacada (izquierda):** `20–30%` + leyenda `de la capacidad del equipo se consume en coordinación manual`

**Bullets (derecha):**
- `Información dispersa — el estado real del proyecto vive en tableros, chats y hojas de cálculo que nadie reconcilia; el PM lo reconstruye a mano cada semana.`
- `Reportes manuales — los informes ejecutivos (avance, velocidad, riesgo de entrega) consumen horas de rol senior y quedan obsoletos al publicarse.`
- `IA decorativa — las suites tradicionales añaden chatbots que describen el tablero pero no pueden actuar sobre él.`
- `Multi-tenancy débil — compartir un proyecto con roles reales (owner / editor / viewer) suele exigir un plan enterprise.`

**Franja inferior:** `So what: hay espacio para una herramienta donde tablero, agente y reporte comparten la misma fuente de verdad — y el agente tiene permiso de ejecutar.`

## 🎨 Dirección visual
Split 30/70: izquierda con la cifra gigante "20–30%" en azul eléctrico sobre panel navy claro; derecha con 4 bullets, cada uno con guion largo separando el concepto en bold del detalle en regular.

## 🤖 Prompt

> Corporate consulting slide, 16:9, white background, McKinsey flat style. Top: gray uppercase kicker "CONTEXTO Y PROBLEMA", bold navy title "Los equipos de datos pierden 20–30% de su capacidad en coordinación que ninguna herramienta genérica resuelve", thin electric blue rule. Left third: very light navy panel with giant electric blue statistic "20–30%" and small gray caption "de la capacidad del equipo se consume en coordinación manual". Right two-thirds: four bullet rows, each with a small electric blue square marker, bold navy lead word and regular gray text: "Información dispersa — el estado real del proyecto vive en tableros, chats y hojas de cálculo que nadie reconcilia; el PM lo reconstruye a mano cada semana." / "Reportes manuales — los informes ejecutivos (avance, velocidad, riesgo de entrega) consumen horas de rol senior y quedan obsoletos al publicarse." / "IA decorativa — las suites tradicionales añaden chatbots que describen el tablero pero no pueden actuar sobre él." / "Multi-tenancy débil — compartir un proyecto con roles reales (owner / editor / viewer) suele exigir un plan enterprise.". Bottom light gray strip: "So what: hay espacio para una herramienta donde tablero, agente y reporte comparten la misma fuente de verdad — y el agente tiene permiso de ejecutar." Render Spanish text exactly. Flat vector, no photos.

---

# DIAPOSITIVA 4 — La solución

## 📝 Texto en la lámina

**Kicker:** `LA SOLUCIÓN`

**Título:** `TaskFlow v3 integra tres capacidades sobre una sola fuente de verdad: ejecutar, razonar y reportar`

**Columna 1 — `EJECUCIÓN COLABORATIVA`**
`Kanban drag-and-drop con updates optimistas y reversión automática. Sincronización en tiempo real entre miembros vía Supabase Realtime. Roles owner / editor / viewer con invitaciones firmadas.`

**Columna 2 — `INTELIGENCIA ACCIONABLE`**
`Agente conversacional con 6 herramientas: crear, actualizar, mover, eliminar, buscar tareas y comentarios. Loop de 2 turnos con streaming token a token. Modo voz en español (dictado + respuesta hablada).`

**Columna 3 — `VISIBILIDAD EJECUTIVA`**
`Burndown, velocidad y riesgo de entrega calculados del dato real. Informe narrativo generado por LLM, exportable a HTML/PDF. Generación de backlog con IA con prompt visible y editable.`

**Franja inferior:** `So what: un solo producto cubre el ciclo completo — planear, ejecutar, preguntar y reportar.`

## 🎨 Dirección visual
Tres columnas con ícono lineal simple arriba de cada una (tablero / burbuja de chat con engranaje / gráfico de barras), título en navy, texto gris. Una línea azul conecta las tres columnas por debajo de los íconos (misma fuente de verdad).

## 🤖 Prompt

> Corporate consulting slide, 16:9, white background, flat vector McKinsey style. Gray kicker "LA SOLUCIÓN", navy bold title "TaskFlow v3 integra tres capacidades sobre una sola fuente de verdad: ejecutar, razonar y reportar", thin electric blue rule. Three equal columns, each with a simple navy line icon at top (kanban board icon / chat bubble with gear icon / bar chart icon), connected underneath by one continuous thin electric blue horizontal line. Column 1 heading "EJECUCIÓN COLABORATIVA", text "Kanban drag-and-drop con updates optimistas y reversión automática. Sincronización en tiempo real entre miembros vía Supabase Realtime. Roles owner / editor / viewer con invitaciones firmadas.". Column 2 heading "INTELIGENCIA ACCIONABLE", text "Agente conversacional con 6 herramientas: crear, actualizar, mover, eliminar, buscar tareas y comentarios. Loop de 2 turnos con streaming token a token. Modo voz en español (dictado + respuesta hablada).". Column 3 heading "VISIBILIDAD EJECUTIVA", text "Burndown, velocidad y riesgo de entrega calculados del dato real. Informe narrativo generado por LLM, exportable a HTML/PDF. Generación de backlog con IA con prompt visible y editable.". Bottom gray strip: "So what: un solo producto cubre el ciclo completo — planear, ejecutar, preguntar y reportar." Render Spanish exactly.

---

# DIAPOSITIVA 5 — Arquitectura técnica

## 📝 Texto en la lámina

**Kicker:** `ARQUITECTURA`

**Título:** `Cuatro capas donde la seguridad vive en la base de datos y la IA es un servicio intercambiable`

**Diagrama de capas (de arriba hacia abajo):**
1. `CLIENTE — Next.js 16 · React 19 · Kanban optimista · Chat SSE · Analítica`
2. `MIDDLEWARE — Validación de sesión en cada navegación · timeout 5s (fail fast)`
3. `SERVIDOR — Server Actions: Auth → Zod → Autorización → Mutación · Agente IA · Rate limit fail-open`
4. `DATOS — Supabase PostgreSQL · RLS en 12 tablas · pgvector halfvec 512 + HNSW · Realtime`

**Panel lateral derecho:** `SERVICIOS IA (intercambiables) — DeepSeek deepseek-chat (principal) · Claude Haiku 4.5 (fallback) · Voyage embeddings + rerank`

**Franja inferior:** `So what: cada capa falla de forma controlada — y ninguna clave privilegiada toca el cliente.`

## 🎨 Dirección visual
Diagrama de 4 bandas horizontales apiladas (cliente arriba, datos abajo) con flechas descendentes finas; a la derecha, un panel vertical punteado con los 3 servicios IA conectado a la banda "Servidor" con flecha bidireccional azul.

## 🤖 Prompt

> Corporate technical architecture slide, 16:9, white background, flat vector McKinsey style. Gray kicker "ARQUITECTURA", navy bold title "Cuatro capas donde la seguridad vive en la base de datos y la IA es un servicio intercambiable", thin electric blue rule. Main area: four stacked horizontal layer bands with thin navy borders and small downward arrows between them, labeled top to bottom: "CLIENTE — Next.js 16 · React 19 · Kanban optimista · Chat SSE · Analítica" / "MIDDLEWARE — Validación de sesión en cada navegación · timeout 5s (fail fast)" / "SERVIDOR — Server Actions: Auth → Zod → Autorización → Mutación · Agente IA · Rate limit fail-open" / "DATOS — Supabase PostgreSQL · RLS en 12 tablas · pgvector halfvec 512 + HNSW · Realtime". Right side: vertical dashed-border panel titled "SERVICIOS IA (intercambiables)" listing "DeepSeek deepseek-chat (principal)", "Claude Haiku 4.5 (fallback)", "Voyage embeddings + rerank", connected to the SERVIDOR band with a bidirectional electric blue arrow. Bottom gray strip: "So what: cada capa falla de forma controlada — y ninguna clave privilegiada toca el cliente." Render Spanish exactly, clean diagram, high legibility.

---

# DIAPOSITIVA 6 — El agente IA por dentro

## 📝 Texto en la lámina

**Kicker:** `EL AGENTE IA`

**Título:** `El agente resuelve en dos turnos: primero decide y ejecuta con herramientas, después responde con evidencia`

**Flujo (izquierda → derecha, 6 pasos):**
1. `Mensaje del usuario`
2. `RAG híbrido: contexto top-5`
3. `TURNO 1 — DeepSeek decide: ¿responder o usar tools?`
4. `Compuerta: ¿acción destructiva? → confirm_required: el stream se detiene hasta confirmación explícita` *(nodo destacado)*
5. `Ejecución de tools en paralelo (validadas por RLS + rol)`
6. `TURNO 2 — respuesta en streaming + citas + refresco del tablero`

**Callout inferior derecho:** `6 herramientas: create_task · update_task · move_task · delete_task · search_tasks · search_comments`

**Franja inferior:** `So what: fricción cero en lo seguro — fricción deliberada en lo irreversible.`

## 🎨 Dirección visual
Flujo horizontal de 6 nodos conectados por flechas; el nodo 4 (compuerta de confirmación) es un rombo de decisión en contorno rojo ladrillo con candado, el resto rectángulos navy. Debajo, cinta gris con las 6 tools en tipografía mono.

## 🤖 Prompt

> Corporate process-flow slide, 16:9, white background, flat vector McKinsey style. Gray kicker "EL AGENTE IA", navy bold title "El agente resuelve en dos turnos: primero decide y ejecuta con herramientas, después responde con evidencia", thin electric blue rule. Center: horizontal flow of six connected nodes with thin arrows, left to right: rectangle "Mensaje del usuario" → rectangle "RAG híbrido: contexto top-5" → rectangle "TURNO 1 — DeepSeek decide: ¿responder o usar tools?" → decision diamond with brick-red (#C0392B) border and a small padlock icon "¿Acción destructiva? confirm_required: el stream se detiene hasta confirmación explícita" → rectangle "Ejecución de tools en paralelo (validadas por RLS + rol)" → rectangle "TURNO 2 — respuesta en streaming + citas + refresco del tablero". All rectangles navy outline on white. Below the flow: light gray ribbon with monospace text "6 herramientas: create_task · update_task · move_task · delete_task · search_tasks · search_comments". Bottom gray strip: "So what: fricción cero en lo seguro — fricción deliberada en lo irreversible." Render Spanish exactly.

---

# DIAPOSITIVA 7 — Pipeline RAG híbrido

## 📝 Texto en la lámina

**Kicker:** `BÚSQUEDA SEMÁNTICA`

**Título:** `La búsqueda combina intención estructural y semántica vectorial; un reranker decide qué merece llegar al LLM`

**Pipeline (izquierda → derecha):**
1. `Consulta del usuario`
2. *(bifurcación)* `Ruta A — Detección de intención: regex bilingüe (es/en) → SQL directo por status/prioridad` · `Ruta B — Embedding voyage-3-lite (512 dims) → búsqueda HNSW por coseno`
3. `Fusión deduplicada → top-20 candidatos`
4. `Reranking con rerank-2-lite`
5. `Top-5 con citas al contexto del LLM`

**Callout:** `Degradación elegante: si el reranker falla, se usan los mejores candidatos sin reordenar — el chat nunca se queda sin contexto por un servicio auxiliar.`

**Franja inferior:** `So what: precisión de búsqueda enterprise con dos APIs de bajo costo — sin infraestructura vectorial dedicada.`

## 🎨 Dirección visual
Diagrama de embudo horizontal: consulta a la izquierda, dos rutas paralelas (A arriba, B abajo) que convergen en "top-20", pasan por el reranker y salen como "top-5". Anchos decrecientes sugieren el filtrado 20→5. Ruta de fallback punteada saltando el reranker.

## 🤖 Prompt

> Corporate data-pipeline slide, 16:9, white background, flat vector McKinsey style. Gray kicker "BÚSQUEDA SEMÁNTICA", navy bold title "La búsqueda combina intención estructural y semántica vectorial; un reranker decide qué merece llegar al LLM", thin electric blue rule. Center: horizontal funnel diagram. Left node "Consulta del usuario" splits into two parallel paths: upper path box "Ruta A — Detección de intención: regex bilingüe (es/en) → SQL directo por status/prioridad", lower path box "Ruta B — Embedding voyage-3-lite (512 dims) → búsqueda HNSW por coseno". Both converge into box "Fusión deduplicada → top-20 candidatos", then narrower box "Reranking con rerank-2-lite", then narrowest highlighted electric blue box "Top-5 con citas al contexto del LLM". A dashed gray bypass arrow skips the reranker box, labeled "fallback". Below: small callout text "Degradación elegante: si el reranker falla, se usan los mejores candidatos sin reordenar — el chat nunca se queda sin contexto por un servicio auxiliar." Bottom gray strip: "So what: precisión de búsqueda enterprise con dos APIs de bajo costo — sin infraestructura vectorial dedicada." Render Spanish exactly.

---

# DIAPOSITIVA 8 — Seguridad en profundidad

## 📝 Texto en la lámina

**Kicker:** `SEGURIDAD`

**Título:** `Cinco capas independientes de defensa: si una falla, la siguiente contiene el daño`

**Tabla (3 columnas: Capa / Mecanismo / Ejemplo concreto):**
1. `BASE DE DATOS` · `RLS en 12 tablas + funciones SECURITY DEFINER` · `Un SELECT ajeno devuelve vacío aunque el código tenga un bug`
2. `SERVER ACTIONS` · `Zod antes de toda query: Auth → Validación → Autorización → Mutación` · `Payloads arbitrarios rechazados antes de tocar datos`
3. `INTEGRIDAD` · `Trigger user_id inmutable; task_assignments como asignación mutable` · `Ni el service_role puede robar la propiedad de una tarea`
4. `SERVICIOS INTERNOS` · `HMAC con hash del body + ventana de 5 minutos` · `Nadie invoca el pipeline de embeddings sin la firma`
5. `CUENTA DEMO` · `Doble capa: la UI redirige a registro + la Server Action rechaza` · `El invitado no puede vaciar el tablero — probado tras un incidente real`

**Franja inferior:** `So what: la seguridad no depende de que la UI se comporte — el servidor y la base de datos son la línea real.`

## 🎨 Dirección visual
Tabla de 5 filas con la primera columna como etiquetas navy en versalitas; entre filas, líneas grises finas. A la izquierda de la tabla, un gráfico vertical de 5 escudos apilados conectados (defensa en profundidad), del más externo (arriba, contorno) al más interno (abajo, relleno navy).

## 🤖 Prompt

> Corporate security slide, 16:9, white background, flat vector McKinsey style. Gray kicker "SEGURIDAD", navy bold title "Cinco capas independientes de defensa: si una falla, la siguiente contiene el daño", thin electric blue rule. Left narrow column: vertical stack of five simple shield outline icons connected by a thin line, progressively more filled with navy from top to bottom. Main area: clean 5-row table with three columns headed "Capa", "Mecanismo", "Ejemplo concreto", thin gray row separators. Rows: "BASE DE DATOS | RLS en 12 tablas + funciones SECURITY DEFINER | Un SELECT ajeno devuelve vacío aunque el código tenga un bug" / "SERVER ACTIONS | Zod antes de toda query: Auth → Validación → Autorización → Mutación | Payloads arbitrarios rechazados antes de tocar datos" / "INTEGRIDAD | Trigger user_id inmutable; task_assignments como asignación mutable | Ni el service_role puede robar la propiedad de una tarea" / "SERVICIOS INTERNOS | HMAC con hash del body + ventana de 5 minutos | Nadie invoca el pipeline de embeddings sin la firma" / "CUENTA DEMO | Doble capa: la UI redirige a registro + la Server Action rechaza | El invitado no puede vaciar el tablero — probado tras un incidente real". Bottom gray strip: "So what: la seguridad no depende de que la UI se comporte — el servidor y la base de datos son la línea real." Render Spanish exactly, high legibility.

---

# DIAPOSITIVA 9 — Caso real: Olist para Sodimac · Mercadeo

## 📝 Texto en la lámina

**Kicker:** `CASO REAL · SODIMAC — ÁREA DE MERCADEO`

**Título:** `El caso Olist demuestra el producto con un proyecto de analítica end-to-end: 60 tareas, 5 roles y 93% de avance consultable por chat`

**Fila de KPIs (4 cifras grandes):**
- `60` `tareas en 6 fases`
- `910 h` `estimadas · feb–jul 2026`
- `93%` `de avance a la fecha de corte`
- `5` `roles con asignación real`

**Bloque izquierdo — `EL PROYECTO`:**
`Analítica de e-commerce (dataset Olist de Kaggle) con arquitectura Medallion completa: Análisis → Bronze → Silver → Gold → Machine Learning → Reportes. Incluye 16 reviews semanales de sprint.`

**Bloque derecho — `EL EQUIPO (tareas asignadas)`:**
`Data Engineer 14 · Data Analyst 13 · ML Engineer 7 · Business Analyst 8 · Scrum Master 18`

**Callout:** `Las 60 tareas tienen embeddings — el agente responde "¿qué tiene pendiente el ML Engineer?" con citas verificables. Demo pública: 1 clic como invitado, con acciones destructivas bloqueadas.`

**Franja inferior:** `So what: no es un demo con datos de relleno — es un backlog realista de ingeniería de datos que el agente entiende y opera.`

## 🎨 Dirección visual
Fila superior de 4 KPIs con cifra gigante azul eléctrico y leyenda gris. Debajo, dos bloques: izquierda texto del proyecto con mini-diagrama de 6 fases (chevrones →), derecha barra horizontal apilada con las tareas por rol.

## 🤖 Prompt

> Corporate case-study slide, 16:9, white background, flat vector McKinsey style. Gray kicker "CASO REAL · SODIMAC — ÁREA DE MERCADEO", navy bold title "El caso Olist demuestra el producto con un proyecto de analítica end-to-end: 60 tareas, 5 roles y 93% de avance consultable por chat", thin electric blue rule. Top row: four KPI blocks with giant electric blue numbers and small gray captions: "60 / tareas en 6 fases", "910 h / estimadas · feb–jul 2026", "93% / de avance a la fecha de corte", "5 / roles con asignación real". Middle left block titled "EL PROYECTO": text "Analítica de e-commerce (dataset Olist de Kaggle) con arquitectura Medallion completa" above a chevron process arrow with six segments labeled "Análisis", "Bronze", "Silver", "Gold", "ML", "Reportes". Middle right block titled "EL EQUIPO": horizontal stacked bar with five navy-to-blue segments labeled "Data Engineer 14", "Data Analyst 13", "ML Engineer 7", "Business Analyst 8", "Scrum Master 18". Below: small callout "Las 60 tareas tienen embeddings — el agente responde '¿qué tiene pendiente el ML Engineer?' con citas verificables. Demo pública: 1 clic como invitado, con acciones destructivas bloqueadas." Bottom gray strip: "So what: no es un demo con datos de relleno — es un backlog realista de ingeniería de datos que el agente entiende y opera." Render Spanish exactly.

---

# DIAPOSITIVA 10 — Calidad y delivery

## 📝 Texto en la lámina

**Kicker:** `CALIDAD Y DELIVERY`

**Título:** `Cinco compuertas automáticas garantizan que lo que llega a producción es exactamente lo que se probó`

**Pipeline horizontal (5 compuertas):**
`1. LINT — 0 warnings` → `2. TYPECHECK — TypeScript estricto` → `3. TESTS — 124 unitarios · cobertura ≥ 70%` → `4. BUILD — producción` → `5. LIGHTHOUSE — LCP < 2.5s · CLS < 0.1 como error` → `DEPLOY PREBUILT`

**Bullets de soporte:**
- `Deploy prebuilt: el artefacto que pasó CI es el que se publica — sin rebuild sorpresa.`
- `E2E con Playwright: 6 specs autenticadas + proyecto público para validar guards sin sesión.`
- `Auditoría IA post-build: 4 blockers detectados y corregidos antes del lanzamiento.`
- `Observabilidad: Sentry con eventos custom, sin fugas de datos personales.`

**Franja inferior:** `So what: la velocidad de entrega no se compró con deuda — se compró con automatización.`

## 🎨 Dirección visual
Pipeline de 5 compuertas como puertas/checkpoints conectados con flechas, la última desemboca en un nodo verde "DEPLOY PREBUILT". Debajo, 4 bullets en dos columnas.

## 🤖 Prompt

> Corporate CI/CD pipeline slide, 16:9, white background, flat vector McKinsey style. Gray kicker "CALIDAD Y DELIVERY", navy bold title "Cinco compuertas automáticas garantizan que lo que llega a producción es exactamente lo que se probó", thin electric blue rule. Center: horizontal pipeline of five gate-shaped checkpoint boxes connected by arrows, labeled "1. LINT — 0 warnings", "2. TYPECHECK — TypeScript estricto", "3. TESTS — 124 unitarios · cobertura ≥ 70%", "4. BUILD — producción", "5. LIGHTHOUSE — LCP < 2.5s · CLS < 0.1 como error", flowing into a final emerald green (#10B981) rounded node "DEPLOY PREBUILT". Below: four short bullets in two columns with small blue square markers: "Deploy prebuilt: el artefacto que pasó CI es el que se publica — sin rebuild sorpresa." / "E2E con Playwright: 6 specs autenticadas + proyecto público para validar guards sin sesión." / "Auditoría IA post-build: 4 blockers detectados y corregidos antes del lanzamiento." / "Observabilidad: Sentry con eventos custom, sin fugas de datos personales.". Bottom gray strip: "So what: la velocidad de entrega no se compró con deuda — se compró con automatización." Render Spanish exactly.

---

# DIAPOSITIVA 11 — Operación real: incidentes y patrones

## 📝 Texto en la lámina

**Kicker:** `OPERACIÓN EN PRODUCCIÓN`

**Título:** `Cuatro incidentes reales en dos semanas dejaron cuatro patrones de resiliencia hoy codificados en el producto`

**Tabla (3 columnas: Incidente real / Impacto / Patrón resultante):**
1. `Redis de rate-limiting eliminado (DNS muerto)` · `Chat, reportes y auditoría caían con error 500` · `FAIL-OPEN: dependencias de costos nunca son single point of failure`
2. `Supabase free-tier pausado por inactividad` · `"This page couldn't load" en cada retorno` · `TIMEOUT EN EL HOT PATH: 5s y fail fast — latencia ajena ≠ downtime propio`
3. `Primer invitado borró el tablero demo` · `Demo inutilizada para los siguientes visitantes` · `DOBLE CAPA DESTRUCTIVA: UI que guía + servidor que rechaza`
4. `Cambio de proveedor LLM requerido` · `Riesgo de reescritura del agente` · `ABSTRACCIÓN OPENAI-COMPATIBLE: migración Groq → DeepSeek en ~1 hora, cero cambios al parser`

**Franja inferior:** `So what: el sistema ya no asume que sus dependencias viven — asume que van a morir y decide cómo degradarse.`

## 🎨 Dirección visual
Tabla de 4 filas; primera columna con punto rojo ladrillo (incidente), tercera columna con check verde y el nombre del patrón en versalitas navy bold. Es la lámina con más contraste rojo/verde de todo el deck.

## 🤖 Prompt

> Corporate incident-review slide, 16:9, white background, flat vector McKinsey style. Gray kicker "OPERACIÓN EN PRODUCCIÓN", navy bold title "Cuatro incidentes reales en dos semanas dejaron cuatro patrones de resiliencia hoy codificados en el producto", thin electric blue rule. Main: clean 4-row table, three columns headed "Incidente real", "Impacto", "Patrón resultante". Each row starts with a small brick-red (#C0392B) dot in column 1 and a small emerald green check mark in column 3. Rows: "Redis de rate-limiting eliminado (DNS muerto) | Chat, reportes y auditoría caían con error 500 | FAIL-OPEN: dependencias de costos nunca son single point of failure" / "Supabase free-tier pausado por inactividad | 'This page couldn't load' en cada retorno | TIMEOUT EN EL HOT PATH: 5s y fail fast — latencia ajena no es downtime propio" / "Primer invitado borró el tablero demo | Demo inutilizada para los siguientes visitantes | DOBLE CAPA DESTRUCTIVA: UI que guía + servidor que rechaza" / "Cambio de proveedor LLM requerido | Riesgo de reescritura del agente | ABSTRACCIÓN OPENAI-COMPATIBLE: migración Groq a DeepSeek en ~1 hora, cero cambios al parser". Pattern names in bold navy small caps. Bottom gray strip: "So what: el sistema ya no asume que sus dependencias viven — asume que van a morir y decide cómo degradarse." Render Spanish exactly.

---

# DIAPOSITIVA 12 — Cierre y siguientes pasos

## 📝 Texto en la lámina

**Kicker:** `CIERRE Y ROADMAP`

**Título:** `La base está en producción; el roadmap multiplica valor sobre lo construido, no lo reconstruye`

**Roadmap 90 días (lista numerada, priorizada por impacto/esfuerzo):**
1. `Restaurar rate limiting con nueva instancia Redis — el fail-open ya protege la transición`
2. `Caché de embeddings de consulta (TTL 1h) — reduce 30–50% las llamadas a Voyage`
3. `Streaming en turno 1 del agente — primer token de ~4s a <500ms percibidos`
4. `Auto-asignación de tareas generadas por IA — del contexto del prompt a asignaciones reales`
5. `Entornos preview completos — validar PRs con datos aislados`

**Mensaje final (destacado):** `TaskFlow v3 demuestra que un equipo pequeño, con arquitectura correcta y disciplina de seguridad, puede llevar IA agéntica a producción real.`

**CTA (botón visual):** `DEMO EN VIVO — 1 clic como invitado: el proyecto Olist, el agente y los reportes están esperando preguntas.`

**Pie:** `MCOY AI + Data Strategy · Datapath Bootcamp · Julio 2026`

## 🎨 Dirección visual
Mitad izquierda: roadmap como timeline vertical de 5 hitos numerados. Mitad derecha: cita destacada en navy grande entre comillas + botón CTA azul eléctrico con texto blanco. Cierre limpio, mismo lenguaje que la portada.

## 🤖 Prompt

> Corporate closing slide, 16:9, white background, flat vector McKinsey style. Gray kicker "CIERRE Y ROADMAP", navy bold title "La base está en producción; el roadmap multiplica valor sobre lo construido, no lo reconstruye", thin electric blue rule. Left half: vertical timeline with five numbered milestone circles (1–5) connected by a thin line, labels: "Restaurar rate limiting con nueva instancia Redis — el fail-open ya protege la transición" / "Caché de embeddings de consulta (TTL 1h) — reduce 30–50% las llamadas a Voyage" / "Streaming en turno 1 del agente — primer token de ~4s a <500ms percibidos" / "Auto-asignación de tareas generadas por IA — del contexto del prompt a asignaciones reales" / "Entornos preview completos — validar PRs con datos aislados". Right half: large navy pull-quote "TaskFlow v3 demuestra que un equipo pequeño, con arquitectura correcta y disciplina de seguridad, puede llevar IA agéntica a producción real." above an electric blue rounded button with white text "DEMO EN VIVO — 1 clic como invitado". Tiny gray footer "MCOY AI + Data Strategy · Datapath Bootcamp · Julio 2026". Render Spanish exactly.

---

# 📌 Consejos de generación (Gemini / ChatGPT)

1. **Un prompt por imagen** — no pidas varias láminas en un solo mensaje.
2. **Si el texto sale deformado:** añade al final del prompt: *"Very important: render every Spanish word EXACTLY as written, do not translate, do not abbreviate."*
3. **Consistencia entre láminas:** genera la 1 primero y en las siguientes añade *"same visual style, palette and typography as the previous slide"* (en ChatGPT, dentro de la misma conversación mantiene coherencia).
4. **Las tablas (láminas 8 y 11) son las más exigentes en texto** — si fallan, pide "increase text size, reduce decorative elements".
5. **Retoque final:** estas imágenes son el arte base; para texto 100% nítido, considera montar los textos largos en PowerPoint/Figma sobre la imagen generada sin textos (pide la variante *"same slide but with empty text placeholders"*).
