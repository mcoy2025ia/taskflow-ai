# TaskFlow v3 — Plan de pruebas para Producción

Fecha de referencia: 2026-05-21  
Entorno: `https://<PRODUCTION_URL>` (reemplazar con la URL real de Vercel)  
Convención: **PASS** / **FAIL** / **SKIP** (feature no implementada o config opcional ausente) / **BLOCKED** (requiere migración pendiente)

---

## Índice

**Pre-vuelo**
- [P0. Lista de verificación pre-deploy](#p0-lista-de-verificación-pre-deploy)
- [P1. Migraciones de Supabase](#p1-migraciones-de-supabase)
- [P2. Variables de entorno en Vercel](#p2-variables-de-entorno-en-vercel)

**Funcionalidades**
1. [Autenticación](#1-autenticación)
2. [Onboarding](#2-onboarding)
3. [Tablero Kanban — CRUD de tareas](#3-tablero-kanban--crud-de-tareas)
4. [Drag & Drop](#4-drag--drop)
5. [Task Drawer — comentarios y metadatos](#5-task-drawer--comentarios-y-metadatos)
6. [Filtro por miembro](#6-filtro-por-miembro)
7. [Sincronización en tiempo real](#7-sincronización-en-tiempo-real)
8. [Agente de IA — chat general](#8-agente-de-ia--chat-general)
9. [Agente de IA — tool calling](#9-agente-de-ia--tool-calling)
10. [Agente de IA — acción destructiva (confirmación)](#10-agente-de-ia--acción-destructiva-confirmación)
11. [RAG — búsqueda semántica](#11-rag--búsqueda-semántica)
12. [Voz — entrada y TTS](#12-voz--entrada-y-tts)
13. [Analítica — métricas y gráficos](#13-analítica--métricas-y-gráficos)
14. [Exportación PDF — informe ejecutivo](#14-exportación-pdf--informe-ejecutivo)
15. [Multi-tenancy — proyectos](#15-multi-tenancy--proyectos)
16. [Invitaciones de colaboración](#16-invitaciones-de-colaboración)
17. [Seguridad de plataforma](#17-seguridad-de-plataforma)
18. [Tema y UI global](#18-tema-y-ui-global)
19. [Rate limiting](#19-rate-limiting)
20. [Performance y Core Web Vitals](#20-performance-y-core-web-vitals)
21. [Observabilidad (Sentry)](#21-observabilidad-sentry)
22. [Degradación graceful](#22-degradación-graceful)
23. [Importación CSV](#23-importación-csv)

**Cierre**
- [Smoke test de producción (10 casos críticos)](#smoke-test-de-producción-10-casos-críticos)
- [Tabla de dependencias de entorno](#tabla-de-dependencias-de-entorno)

---

## P0. Lista de verificación pre-deploy

Ejecutar antes de comenzar cualquier prueba funcional. Todo debe estar en **PASS** antes de continuar.

| # | Verificación | Cómo comprobar | Estado |
|---|---|---|---|
| P0-01 | Deploy de Vercel en estado `Ready` | Dashboard Vercel → Deployments | [ ] |
| P0-02 | URL de producción responde con HTTP 200 | `curl -I https://<URL>` | [ ] |
| P0-03 | HTTPS forzado (no sirve HTTP plano) | `curl -I http://<URL>` → esperar 301 | [ ] |
| P0-04 | Migraciones 001–010 aplicadas en Supabase remoto | Ver P1 abajo | [ ] |
| P0-05 | Variables críticas configuradas en Vercel | Ver P2 abajo | [ ] |
| P0-06 | `npm test` pasa limpio en la rama desplegada | GitHub Actions → CI job | [ ] |
| P0-07 | `npx tsc --noEmit` sin errores en la rama desplegada | GitHub Actions → CI job | [ ] |

---

## P1. Migraciones de Supabase

Las migraciones 006–010 no se auto-aplican. Verificar en Supabase Dashboard → Table Editor que existen las siguientes tablas:

| Migración | Tablas / objetos creados | Estado |
|---|---|---|
| 001_profiles.sql | `profiles` | [ ] |
| 002_tasks.sql | `tasks` con columna `project_id` | [ ] |
| 003_embeddings.sql | `task_embeddings` con `halfvec(512)` | [ ] |
| 004_rls_policies.sql | RLS activo en `tasks`, `task_embeddings` | [ ] |
| 005_projects.sql | `projects`, `project_phases` | [ ] |
| 006_chat_sessions.sql | `chat_sessions`, `chat_messages` | [ ] |
| 007_collaboration.sql | `project_members`, `task_assignments`, `comments`, `activity_log` | [ ] |
| 008_invitations.sql | `pending_invitations`, funciones `get_invitation_by_token`, `accept_invitation` | [ ] |
| 009_security_definer.sql | Funciones `is_project_member`, `is_project_editor`, `get_project_member_profiles` | [ ] |
| 010_realtime.sql | `tasks` y `task_assignments` en `supabase_realtime` | [ ] |

**Si falta alguna migración:** Dashboard → SQL Editor → pegar y ejecutar el archivo correspondiente en orden.

---

## P2. Variables de entorno en Vercel

Verificar en Vercel → Settings → Environment Variables que existen para `Production`:

| Variable | Requerida | Impacto si falta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | App no carga (error de configuración al boot) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | App no carga |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | `/api/embed` falla; embeddings nunca se generan |
| `GROQ_API_KEY` | Sí | Chat falla; `env.ts` lanza error al boot |
| `VOYAGE_API_KEY` | Sí | RAG y embeddings fallan; `env.ts` lanza error al boot |
| `EMBED_INTERNAL_SECRET` | Sí | `/api/embed` rechaza todas las peticiones (HMAC inválido) |
| `NEXT_PUBLIC_APP_URL` | Sí | Links de invitación con URL incorrecta |
| `UPSTASH_REDIS_REST_URL` | Sí | Rate limiting desactivado (no crash, solo sin límites) |
| `UPSTASH_REDIS_REST_TOKEN` | Sí | Rate limiting desactivado |
| `CRON_SECRET` | Sí | Cron de insights abierto sin auth |
| `ANTHROPIC_API_KEY` | Opcional | Fallback a Claude Haiku desactivado |
| `RESEND_API_KEY` | Opcional | Emails de invitación no se envían (URL queda en logs) |
| `AI_GATEWAY_BASE_URL` | Opcional | Groq llamado directamente sin gateway |
| `NEXT_PUBLIC_SENTRY_DSN` | Opcional | Errores no reportados a Sentry |
| `SENTRY_ORG` + `SENTRY_PROJECT` + `SENTRY_AUTH_TOKEN` | Opcional | Source maps no subidos |

---

## 1. Autenticación

### AUTH-01 — Registro de nuevo usuario
**Pre-condición:** email que no existe en la DB  
**Pasos:**
1. Ir a `https://<URL>/register`
2. Ingresar nombre completo, email nuevo, contraseña ≥ 8 caracteres
3. Enviar formulario

**Esperado:** redirección a `/board`; sidebar visible; nombre en topbar  
**Verificar en Supabase:** fila en `profiles` con `full_name` correcto

---

### AUTH-02 — Login con credenciales válidas
**Pasos:**
1. Ir a `https://<URL>/login`
2. Ingresar email y contraseña correctos

**Esperado:** redirección a `/board` con tablero cargado; cookie de sesión en DevTools → Application → Cookies

---

### AUTH-03 — Login con credenciales inválidas
**Pasos:** enviar email correcto + contraseña incorrecta

**Esperado:** mensaje de error visible ("Credenciales inválidas" o similar); sin redirección; sin exposición de detalles internos en UI

---

### AUTH-04 — Validación de formulario de registro
**Casos a probar:**
- Email sin `@` → error de formato
- Contraseña vacía → error requerido
- Nombre vacío → error requerido

**Esperado:** errores inline antes del submit; sin petición HTTP al servidor

---

### AUTH-05 — Protección de rutas sin sesión
**Pasos:** abrir ventana incógnita → navegar a `/board`, `/chat`, `/analytics`

**Esperado:** cada una redirige a `/login` con código HTTP 307; sin page blank; sin 500

---

### AUTH-06 — Cerrar sesión
**Pasos:** click "Cerrar sesión" en sidebar

**Esperado:** cookie de sesión eliminada; redirección a `/login`; intentar ir a `/board` redirige de nuevo a `/login`

---

## 2. Onboarding

### ONBOARD-01 — Modal primer acceso
**Pre-condición:** cuenta nueva sin `localStorage.onboarding_done`  
**Pasos:** navegar a `/board`

**Esperado:** modal con 4 dots de progreso; paso 1 activo; sin error de consola

---

### ONBOARD-02 — Crear proyecto demo
**Pasos:** click "Crear proyecto demo" en el onboarding

**Esperado:**
- Spinner "Creando…" durante la operación
- Modal cierra; tablero cargado con tareas demo
- URL actualiza a `?project_id=<uuid>`
- `localStorage.onboarding_done = '1'`
- Verificar en Supabase: fila en `projects` + filas en `tasks` + fila en `project_members` (role: owner)

---

### ONBOARD-03 — Omitir onboarding
**Pasos:** click "Omitir" en cualquier paso

**Esperado:** modal desaparece; `localStorage.onboarding_done = '1'`; al recargar no vuelve a aparecer

---

## 3. Tablero Kanban — CRUD de tareas

### KANBAN-01 — Crear tarea mínima
**Pasos:** click "+" en columna "Por hacer" → ingresar título → guardar

**Esperado:** tarjeta aparece al final de la columna; sin recargar la página  
**Verificar en Supabase:** fila en `tasks` con `status = 'todo'`, `user_id` del usuario actual  
**Verificar en red (DevTools → Network):** petición a `/api/embed` con HMAC en headers (embedding disparado en fire-and-forget)

---

### KANBAN-02 — Crear tarea completa
**Pasos:** crear tarea con título + descripción + prioridad Alta + fecha límite mañana

**Esperado:** badge de prioridad rojo visible en la tarjeta; fecha visible; descripción accesible en drawer

---

### KANBAN-03 — Editar tarea
**Pasos:** abrir drawer → cambiar título y descripción → guardar

**Esperado:** cambios reflejados en la tarjeta; persisten al recargar la página

---

### KANBAN-04 — Eliminar tarea
**Pasos:** abrir menú de la tarjeta → confirmar eliminación

**Esperado:** tarjeta desaparece de la columna; no aparece en DB (verificar en Supabase)

---

### KANBAN-05 — Validación: título vacío
**Esperado:** error inline; sin petición al servidor

---

### KANBAN-06 — Validación: título > 200 caracteres
**Esperado:** error de validación por longitud; Zod bloquea antes de insert

---

### KANBAN-07 — Asignar tarea a miembro del proyecto
**Pre-condición:** proyecto con ≥ 2 miembros (migración 007 aplicada)  
**Pasos:** abrir drawer → sección "Asignados" → seleccionar miembro

**Esperado:** avatar aparece en la tarjeta; fila en `task_assignments` en Supabase  
**Si migración 007 no aplicada:** BLOCKED

---

### KANBAN-08 — InsightBanner de tareas vencidas
**Pre-condición:** tarea con `due_date` pasada y status ≠ `done`  
**Pasos:** cargar `/board`

**Esperado:** banner amber en la parte superior; click en X lo dismiss para esa sesión

---

## 4. Drag & Drop

### DND-01 — Mover entre columnas
**Pasos:** arrastrar tarjeta de "Por hacer" a "En progreso"

**Esperado:** tarjeta aparece en nueva columna de inmediato (optimistic); `status` actualizado en DB al soltar

---

### DND-02 — Orden dentro de la misma columna
**Pasos:** arrastrar tarjeta entre dos tarjetas de la misma columna

**Esperado:** nuevo orden persiste al recargar; posición calculada como `Math.round((prev + next) / 2)`

---

### DND-03 — Revertir si falla el servidor
**Simulación:** DevTools → Network → bloquear la URL de Supabase → drag & drop

**Esperado:** tarjeta vuelve a su posición original (rollback `useOptimistic`); sin error en UI

---

## 5. Task Drawer — comentarios y metadatos

### DRAWER-01 — Ver metadatos
**Esperado en el drawer:** título, descripción, status badge en español, prioridad con color, fecha límite localizada (es-CO), avatares de asignados

---

### DRAWER-02 — Agregar comentario
**Pre-condición:** migración 007 aplicada  
**Pasos:** escribir comentario → click "Enviar"

**Esperado:** comentario aparece al final; fila en `comments` en Supabase  
**Si migración 007 no aplicada:** BLOCKED

---

### DRAWER-03 — Eliminar propio comentario
**Esperado:** icono de papelera visible solo para comentarios propios; click elimina sin recargar

---

### DRAWER-04 — Comentario vacío no se envía
**Esperado:** sin petición al servidor; textarea sigue vacía

---

## 6. Filtro por miembro

### FILTER-01 — Activar y desactivar filtro
**Pre-condición:** proyecto con tareas asignadas a distintos miembros  
**Pasos:** click en avatar en `MemberFilterBar` → verificar solo tareas de ese miembro visibles → click de nuevo para quitar

**Esperado:** filtro activo resalta el chip; drag & drop funciona sobre tareas filtradas

---

## 7. Sincronización en tiempo real

**Pre-condición:** migración 010 aplicada (tablas en `supabase_realtime`)

### REALTIME-01 — Crear tarea vista por otro usuario
**Setup:** mismo proyecto abierto en dos navegadores diferentes con usuarios distintos  
**Pasos:** en sesión B, crear tarea

**Esperado en sesión A:** tarjeta aparece sin recargar; toast "Nueva tarea creada por [nombre]"  
**Si migración 010 no aplicada:** BLOCKED

---

### REALTIME-02 — Los propios cambios no disparan toast
**Pasos:** en sesión A, crear o mover tarea

**Esperado en sesión A:** sin toast (skip por `record.user_id === currentUserId`)

---

## 8. Agente de IA — chat general

### CHAT-01 — Pregunta sobre tareas (streaming)
**Pasos:** ir a `/chat` → escribir "¿Cuántas tareas tengo pendientes?" → enviar

**Esperado:** texto llega token a token (SSE); respuesta coherente con el tablero; chips de fuentes visibles al final  
**Verificar en Network:** request a `/api/chat` con `transfer-encoding: chunked` o `content-type: text/event-stream`

---

### CHAT-02 — Historial persiste en sesión
**Pre-condición:** migración 006 aplicada  
**Pasos:** enviar 2 mensajes; recargar la página; abrir el mismo `?session_id=`

**Esperado:** historial anterior visible; el LLM mantiene contexto  
**Si migración 006 no aplicada:** BLOCKED

---

### CHAT-03 — URL con `session_id` protegida por ownership
**Pasos:** copiar URL con `?session_id=` de usuario A → abrirla logueado como usuario B

**Esperado:** chat carga vacío (sin el historial de A); no hay fuga de datos entre usuarios

---

### CHAT-04 — Sidebar de sesiones recientes
**Estado:** SKIP — pendiente de implementación (backlog post-10)  
El action `getChatSessions()` existe pero no hay UI que renderice la lista de sesiones.

---

### CHAT-05 — Bloqueo de bot
**Pasos desde terminal:**
```bash
curl -X POST https://<URL>/api/chat \
  -H "x-vercel-is-bot: 1" \
  -H "Content-Type: application/json" \
  -d '{"message":"test","sessionId":"test"}'
```

**Esperado:** HTTP 403 `{"error":"Acceso no permitido para bots"}`  
**Nota:** en producción Vercel inyecta este header automáticamente para bots reales — la verificación manual via curl valida que `bot-guard.ts` funciona

---

## 9. Agente de IA — tool calling

### TOOL-01 — Crear tarea via chat
**Pasos:** escribir "Crea una tarea llamada 'Test producción 001' con prioridad alta"

**Esperado:**
- Badge de tool activity visible mientras se ejecuta (`tool_call` → `tool_result`)
- Tarea aparece en el tablero sin recargar (evento `board_update`)
- Verificar en Supabase: fila en `tasks` con `title = 'Test producción 001'`

---

### TOOL-02 — Mover tarea via chat
**Pasos:** escribir "Mueve la tarea 'Test producción 001' a En progreso"

**Esperado:** LLM llama `search_tasks` para encontrar el ID → luego `move_task` → tarjeta cambia de columna en el tablero

---

### TOOL-03 — Búsqueda de tareas via chat
**Pasos:** escribir "¿Cuáles son mis tareas de alta prioridad?"

**Esperado:** LLM llama `search_tasks` con `priority: high`; lista las tareas en la respuesta con sus nombres reales

---

### TOOL-04 — Búsqueda de comentarios via chat
**Pre-condición:** comentario creado en DRAWER-02 con algún texto específico (ej. "revisión pendiente")  
**Pasos:** escribir "¿Hay alguna discusión sobre revisión pendiente en los comentarios?"

**Esperado:** LLM llama `search_comments`; cita el comentario relevante con el `task_id`

---

## 10. Agente de IA — acción destructiva (confirmación)

### CONFIRM-01 — Eliminar tarea requiere ConfirmCard
**Pasos:** escribir "Elimina la tarea 'Test producción 001'"

**Esperado:**
- Stream se detiene
- `ConfirmCard` visible con nombre de la tarea y botones "Eliminar" y "Cancelar"
- Tarea todavía existe en el tablero y en DB

---

### CONFIRM-02 — Confirmar eliminación
**Pasos:** click "Confirmar" en la ConfirmCard

**Esperado:**
- POST a `/api/chat/confirm` con `{ tool: 'delete_task', args: { task_id: '...' } }`
- Tarea desaparece del tablero
- Verificar en Supabase: fila ya no existe en `tasks`
- LLM confirma la eliminación en texto

---

### CONFIRM-03 — Cancelar eliminación
**Pasos:** click "Cancelar" en la ConfirmCard

**Esperado:** tarea permanece en tablero y DB; conversación continúa normalmente

---

## 11. RAG — búsqueda semántica

### RAG-01 — Búsqueda por intención estructural
**Pre-condición:** tareas en estado `done`  
**Pasos:** escribir en chat "Muéstrame las tareas completadas"

**Esperado:** chips de fuentes muestran tareas con `status: done`; RAG detectó intent vía regex y usó SQL directo

---

### RAG-02 — Búsqueda semántica vectorial
**Pre-condición:** embeddings generados para las tareas (verificar filas en `task_embeddings`)  
**Pasos:** escribir "¿Qué tareas relacionadas con análisis de datos hay?"

**Esperado:** chips de fuentes muestran tareas semánticamente relevantes aunque no tengan las palabras exactas

---

### RAG-03 — Máximo 5 fuentes post-rerank
**Pasos:** hacer pregunta genérica que active RAG

**Esperado:** chips de fuentes muestran ≤ 5 resultados (top-5 post-reranking, nunca top-20)

---

### RAG-04 — Embeddings actualizados tras crear tarea
**Pasos:** crear tarea con título único → esperar 5 segundos → preguntar sobre ese título en el chat

**Esperado:** la tarea nueva aparece en las fuentes (el fire-and-forget a `/api/embed` completó en background)

---

## 12. Voz — entrada y TTS

### VOICE-01 — Activar entrada de voz
**Pre-condición:** Chrome o Edge (Web Speech API disponible)  
**Pasos:** click en ícono de micrófono → hablar → texto transcrito aparece en input

**Esperado:** indicador visual de grabación activo; transcripción coherente

---

### VOICE-02 — TTS en respuesta
**Pre-condición:** modo voz activado  
**Pasos:** enviar mensaje → esperar respuesta

**Esperado:** `SpeechSynthesisUtterance` se activa; respuesta leída en español (es-CO, rate 1.1); los tool calls no se leen en voz alta

---

### VOICE-03 — Sin Web Speech API (Firefox)
**Pasos:** abrir `/chat` en Firefox

**Esperado:** botón de micrófono deshabilitado o ausente; sin errores en consola

---

## 13. Analítica — métricas y gráficos

### ANALYTICS-01 — KPIs correctos
**Pre-condición:** proyecto con N tareas (anotar el conteo manual por estado antes de probar)  
**Pasos:** ir a `/analytics`

**Verificar:**
- "Completadas": coincide con conteo real de `done`
- "En Progreso": coincide con `in_progress`
- "Por Hacer": coincide con `todo`
- "Días Restantes": calculados correctamente desde `delivery_date` del proyecto en DB (fechas UTC, no locales)

---

### ANALYTICS-02 — Indicador de riesgo
**Lógica:** `atRisk = velocityRequired > velocityActual`  
**Esperado si en riesgo:** KPI muestra "⚠ Riesgo" en rojo; panel de velocidad con borde rojo  
**Esperado si en tiempo:** "✓ En tiempo" en verde

---

### ANALYTICS-03 — Carga con error manejado
**Pasos:** revocar permisos de `tasks` en RLS temporalmente → cargar `/analytics`

**Esperado:** mensaje de error visible ("Error al cargar…"); sin pantalla en blanco; sin crash de React  
**Nota:** este comportamiento fue corregido en `use-analytics.ts` — loading no puede quedar atascado

---

### ANALYTICS-04 — Gráfico burndown
**Esperado:** barras visibles por semana con label S1, S2, …; línea real y línea ideal diferenciadas; semanas coherentes con `start_date` del proyecto

---

### ANALYTICS-05 — Gráfico de fases
**Pre-condición:** fases configuradas en `project_phases` en DB  
**Esperado:** barra de progreso por fase con `done/total` y porcentaje correcto; color de cada fase respetado

---

## 14. Exportación PDF — informe ejecutivo

### PDF-01 — Generar informe
**Pasos:** click "Exportar PDF" en `/analytics`

**Esperado:**
- Botón muestra spinner "Generando…" y se deshabilita durante la generación
- Request a `/api/report` con el summary de métricas del proyecto activo
- Archivo `.pdf` descargado con nombre que incluye el nombre del proyecto
- El PDF incluye datos dinámicos del proyecto (nombre real, fechas reales, fases reales)

---

### PDF-02 — Estructura del PDF
**Verificar en el PDF descargado:**
- Título con nombre real del proyecto y fecha de entrega real
- Secciones presentes sin markdown: `RESUMEN EJECUTIVO:`, `ESTADO SEMANAL:`, `ESTADO POR FASE:`, `RECOMENDACIONES:`, `VISIÓN CRÍTICA:`
- Fases del pipeline listadas con `done/total` y estado (COMPLETA / En ejecución / Sin iniciar)
- Gráfico de barras de burndown incluido
- Texto narrativo del LLM integrado con párrafos limpios

---

### PDF-03 — No hay hardcoding de Olist
**Verificar:** el PDF generado no menciona "Olist", "Bronze", "Silver", "Gold" a menos que esos sean los nombres reales del proyecto activo en DB

---

## 15. Multi-tenancy — proyectos

### PROJECT-01 — Crear nuevo proyecto
**Pasos:** click "Nuevo proyecto" en el `ProjectSwitcher`

**Esperado:** modal con campos nombre, fecha inicio, fecha entrega → guardar crea proyecto; aparece en el selector  
**Verificar en Supabase:** fila en `projects` + fila en `project_members` con `role = 'owner'`

---

### PROJECT-02 — Cambiar de proyecto
**Pre-condición:** 2+ proyectos en la cuenta  
**Pasos:** click en otro proyecto en el `ProjectSwitcher`

**Esperado:** URL actualiza a `?project_id=<uuid>`; tablero carga solo tareas de ese proyecto; selección persiste en `localStorage`

---

### PROJECT-03 — RLS: datos aislados entre usuarios
**Pasos:** con usuario A, obtener el `project_id` → con usuario B (sin membresía), navegar a `?project_id=<id-de-A>`

**Esperado:** tablero vacío; no se ven las tareas del usuario A  
**Verificar:** query en Supabase con `anon key` de B retorna `[]` para esas tareas (RLS activo)

---

## 16. Invitaciones de colaboración

**Pre-condición:** migraciones 007 y 008 aplicadas. Si no: BLOCKED en todos los casos de esta sección.

### INVITE-01 — Enviar invitación
**Pasos:** desde el panel de miembros del proyecto → ingresar email de otro usuario → rol "Editor" → enviar

**Esperado si `RESEND_API_KEY` configurado:** email llegó al destinatario; verificar en Resend Dashboard → Emails  
**Esperado si sin `RESEND_API_KEY`:** URL de invitación logueada en Vercel → Functions → logs del request  
**Verificar en Supabase:** fila en `pending_invitations` con token hex-64 y `expires_at = ahora + 7 días`

---

### INVITE-02 — Aceptar invitación
**Pasos:** abrir URL `/invite/<token>` con la cuenta correcta → click "Aceptar invitación"

**Esperado:** upsert en `project_members`; redirección a `/board` con el proyecto disponible en `ProjectSwitcher`; `accepted_at` seteado en `pending_invitations`

---

### INVITE-03 — Email diferente al invitado
**Pasos:** abrir `/invite/<token>` logueado con cuenta diferente al email invitado

**Esperado:** aviso amber sobre el mismatch de email; botón "Aceptar" sigue funcionando

---

### INVITE-04 — Invitación expirada
**Pre-condición:** token con `expires_at` en el pasado (editar en Supabase para testing)

**Esperado:** página muestra "Invitación expirada"; sin botón de aceptar

---

### INVITE-05 — Sin sesión al abrir invitación
**Pasos:** abrir `/invite/<token>` en ventana incógnita

**Esperado:** botón "Iniciar sesión" con redirect que apunta de vuelta al invite; tras login, redirección al token correcto

---

### INVITE-06 — Viewer no puede mutar tareas
**Pre-condición:** usuario invitado con rol `viewer`  
**Pasos:** intentar crear, editar o eliminar tarea en el proyecto compartido

**Esperado:** acción bloqueada por RLS (error o UI deshabilitada); Supabase retorna error de permiso; no hay mutación en DB

---

## 17. Seguridad de plataforma

### SEC-01 — Headers de seguridad
**Pasos:**
```bash
curl -I https://<URL>
```

**Esperado — headers presentes:**
- `strict-transport-security: max-age=31536000; includeSubDomains`
- `x-frame-options: DENY`
- `x-content-type-options: nosniff`
- `referrer-policy: strict-origin-when-cross-origin`
- `content-security-policy: ...` (con `default-src 'self'`)

**Validación completa:** abrir `securityheaders.com` con la URL de producción → esperado **A+**

---

### SEC-02 — `/api/embed` sin HMAC rechaza
```bash
curl -X POST https://<URL>/api/embed \
  -H "Content-Type: application/json" \
  -d '{"taskId":"x","title":"x","userId":"x"}'
```

**Esperado:** HTTP 401 `{"error":"Unauthorized"}`

---

### SEC-03 — `/api/embed` HMAC expirado rechaza
**Simulación:** generar firma con timestamp de hace 6 minutos usando `signRequest` con `EMBED_INTERNAL_SECRET` real

**Esperado:** HTTP 401 (ventana de 5 minutos expirada)

---

### SEC-04 — `/api/cron/insights` sin `CRON_SECRET` rechaza
```bash
curl https://<URL>/api/cron/insights
```

**Esperado:** HTTP 401 o 403

---

### SEC-05 — `/api/cron/insights` con header correcto acepta
```bash
curl https://<URL>/api/cron/insights \
  -H "Authorization: Bearer <CRON_SECRET>"
```

**Esperado:** HTTP 200; respuesta de éxito o `{ skipped: true }` si no hay proyectos con tareas vencidas

---

### SEC-06 — `SUPABASE_SERVICE_ROLE_KEY` no expuesto al cliente
**Pasos:** abrir DevTools → Sources → buscar "service_role" en todos los archivos JS del bundle

**Esperado:** ninguna aparición en el bundle del cliente

---

### SEC-07 — Middleware excluye rutas de API internas
**Verificar:** request a `/api/embed` y `/api/backfill` sin cookies → no hay redirección a `/login`  
**Esperado:** cada ruta maneja su propia auth (HMAC / CRON_SECRET)

---

### SEC-08 — RLS: no select cross-user desde el cliente
**Pasos:** con el `anon key` y token JWT del usuario A, hacer request directo a Supabase REST para tareas del usuario B  
```bash
curl "https://<SUPABASE_URL>/rest/v1/tasks?user_id=eq.<uuid-de-B>" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT-de-A>"
```

**Esperado:** array vacío `[]` (RLS bloquea silenciosamente)

---

## 18. Tema y UI global

### THEME-01 — Toggle claro/oscuro sin flash
**Pasos:** activar tema oscuro → recargar  

**Esperado:** tema oscuro desde el primer render (script en `<head>` ejecuta antes de React); sin FOUC  
**Si hay flash:** el `<script dangerouslySetInnerHTML>` fue movido de `<head>` — revisar `app/layout.tsx`

---

### THEME-02 — Responsive en móvil (375px)
**Pasos:** DevTools → modo responsive 375px → navegar por todas las secciones

**Verificar:**
- Analytics: grid 2 columnas en mobile (no 4)
- Board: columnas con scroll horizontal
- Chat: UI no desbordada
- Sidebar: colapsa o tiene overlay

---

## 19. Rate limiting

**Pre-condición:** `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` configurados en producción

### RL-01 — Chat: 21 mensajes en < 1 minuto
**Pasos:** enviar 21 mensajes en sucesión rápida (script o manual)

**Esperado:** a partir del 21: evento `{ type: 'error', message: 'Demasiadas solicitudes...' }` en el stream; botón vuelve a estado normal

---

### RL-02 — Report: 6 exportaciones en < 1 minuto
**Pasos:** click "Exportar PDF" 6 veces en < 1 minuto

**Esperado:** 6ta petición → HTTP 429; botón sale de estado "Generando…"

---

### RL-03 — Recuperación del rate limit
**Pasos:** llegar al límite → esperar 60 segundos → enviar un mensaje

**Esperado:** petición aceptada normalmente (ventana rolling de 60s)

---

### RL-04 — Headers informativos de rate limit
**Pasos:** hacer petición a `/api/chat` y ver headers de respuesta

**Esperado:** headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` presentes

---

## 20. Performance y Core Web Vitals

### PERF-01 — PageSpeed Insights ≥ 90
**Pasos:** abrir `pagespeed.web.dev` con la URL de producción (móvil y desktop)

**Esperado:** puntuación Performance ≥ 90 en ambos  
**Si falla:** revisar LCP (Geist font preload), CLS (layout shifts), TBT (JS bloqueante)

---

### PERF-02 — Lighthouse CI en CI/CD
**Pasos:** revisar el job `ci` en GitHub Actions → paso "Run Lighthouse CI"

**Esperado:**
- LCP < 2.5s (error si supera)
- CLS < 0.1 (error si supera)
- TBT < 200ms (warning si supera)

---

### PERF-03 — jsPDF sin html2canvas en producción
**Pasos:** generar un PDF → abrir DevTools → Network → buscar "html2canvas"

**Esperado:** ninguna request a `html2canvas`; sin errores relacionados con colores oklch; PDF generado con jsPDF puro

---

### PERF-04 — Bundle de PDF cargado lazily
**Pasos:** cargar `/analytics` → Network → buscar "jspdf" en los chunks iniciales

**Esperado:** `jsPDF` NO aparece en el bundle inicial; solo aparece en Network cuando se hace click en "Exportar PDF" (lazy import)

---

## 21. Observabilidad (Sentry)

**Pre-condición:** `NEXT_PUBLIC_SENTRY_DSN` configurado en producción

### SENTRY-01 — Errores capturados automáticamente
**Pasos:** provocar un error (ej. navegar a una ruta inexistente como `/boom`)

**Esperado:** evento aparece en Sentry Dashboard → Issues en los próximos 30 segundos

---

### SENTRY-02 — Eventos custom de agente
**Pasos:** crear una tarea via chat (TOOL-01)

**Esperado en Sentry Dashboard → Performance / Breadcrumbs:**
- Breadcrumb `agent.tool_called` con `{ tool: 'create_task' }`
- Breadcrumb `chat.completion` con `{ provider: 'groq', toolsUsed: 1 }`

---

### SENTRY-03 — `global-error.tsx` captura errores de Server Component
**Simulación:** en Supabase, corromper temporalmente la conexión (RLS rota) para que un Server Component lance excepción

**Esperado:** `global-error.tsx` muestra página de error amigable; evento reportado a Sentry; sin pantalla en blanco

---

## 22. Degradación graceful

### ERR-01 — Fallback a Claude Haiku si Groq falla
**Pre-condición:** `ANTHROPIC_API_KEY` configurada; `GROQ_API_KEY` temporalmente inválida  
**Pasos:** enviar mensaje al chat

**Esperado:** respuesta llega (vía Claude Haiku); log en Vercel Functions: `[agent] Groq no disponible, usando Claude Haiku fallback`  
**Si `ANTHROPIC_API_KEY` no configurada:** evento `{ type: 'error', message: '...' }` visible en la UI

---

### ERR-02 — Voyage AI falla gracefully
**Pre-condición:** `VOYAGE_API_KEY` temporalmente inválida  
**Pasos:** enviar mensaje al chat

**Esperado:** chat sigue respondiendo (RAG usa fallback sin reranking); sin crash 500; log de warning en Vercel

---

### ERR-03 — Analytics sin proyecto en DB
**Pre-condición:** cuenta nueva sin proyectos  
**Pasos:** ir a `/analytics`

**Esperado:** mensaje "Sin datos de proyecto." centrado en pantalla; sin crash; sin loop infinito de carga  
**Nota:** corregido en `use-analytics.ts` — `PGRST116` (no rows) tratado como estado válido, no como error

---

### ERR-04 — Supabase Realtime desconectado
**Simulación:** activar Network Throttling a "Offline" por 10 segundos mientras hay otra sesión activa

**Esperado:** sin crash; al reconectar, el tablero muestra el estado actualizado tras recargar; no hay errores de WebSocket en consola

---

---

## 23. Importación CSV

**Pre-condición:** usuario autenticado con proyecto activo (o espacio personal); tablero **vacío** (después de "Borrar todo" o cuenta nueva sin tareas).

### CSV-01 — Empty state muestra el importador en el board
**Pasos:** ir a `/board` con 0 tareas (o usar "Borrar todo" si hay tareas)

**Esperado:**
- En lugar de las 3 columnas Kanban vacías, aparece el panel de importación con: intro card, tabla de estructura de campos, botón "↓ Descargar plantilla", y drop zone
- `MemberFilterBar` queda oculto (no aplica sin tareas)

---

### CSV-02 — Descargar plantilla
**Pasos:** click en "↓ Descargar plantilla"

**Esperado:** archivo `template-tareas.csv` descargado con encabezados `title,description,status,priority,due_date` y 10 filas Olist de ejemplo

---

### CSV-03 — Drop zone acepta drag & drop
**Pasos:** arrastrar un `.csv` válido desde el explorador hasta la zona punteada

**Esperado:**
- Borde de la zona cambia a azul mientras se arrastra
- Al soltar, se parsea y muestra preview con primeras 10 filas
- Badges de status (Por hacer / En curso / Completa) y priority (▲ Alta / ● Media / ▼ Baja) renderizados

---

### CSV-04 — Click abre selector de archivos
**Pasos:** click en la drop zone

**Esperado:** se abre el file picker del sistema con filtro `.csv`

---

### CSV-05 — Importar tareas con CSV válido
**Pasos:** seleccionar `template-tareas.csv` → ver preview → click "🚀 Importar 10 tareas →"

**Esperado:**
- Spinner "Importando…" en la drop zone
- Al completar: resultado con `Insertadas: 10`, `Con errores: 0`
- `router.refresh()` repuebla el server component → el board ahora muestra las 10 tareas distribuidas en sus columnas (todo / in_progress / done)
- El importador desaparece (ya no hay empty state)
- Verificar en Supabase: 10 nuevas filas en `tasks` con `position` espaciado de 1000

---

### CSV-06 — Validación: archivo sin columna `title`
**Pasos:** subir un CSV cuya primera fila no contiene `title`

**Esperado:** mensaje de error "Columna 'title' no encontrada. Revisa que el CSV tenga encabezados."; no se llama al server action

---

### CSV-07 — Validación: archivo > 500 filas
**Pasos:** subir un CSV con 501 filas

**Esperado:** server action retorna error "Máximo 500 filas por importación"; sin inserción en DB

---

### CSV-08 — Validación: fila con `title` vacío
**Pasos:** subir CSV donde la fila 3 tiene `title=""`

**Esperado:**
- Las otras 9 filas se insertan correctamente (`Insertadas: 9`)
- La fila 3 aparece en la lista de errores: `Fila 3 · title · El título es obligatorio`

---

### CSV-09 — Tolerancia: `status` o `priority` inválido usa default
**Pasos:** CSV con fila que tiene `status=PENDIENTE` y `priority=URGENTE`

**Esperado:** la fila se inserta con `status='todo'` y `priority='medium'` (Zod `.catch()` aplica defaults); no genera error

---

### CSV-10 — Formato de fecha `DD/MM/YYYY`
**Pasos:** CSV con `due_date=15/06/2026`

**Esperado:** se transforma a `2026-06-15` y se guarda correctamente en DB; visible en la tarjeta del board

---

### CSV-11 — Sin permisos en proyecto compartido
**Pre-condición:** usuario con rol `viewer` en un proyecto compartido  
**Pasos:** intentar importar CSV con `projectId` del proyecto donde es viewer

**Esperado:** server action retorna "No tienes permisos de edición en este proyecto"; sin inserción

---

### CSV-12 — Embeddings throttleados en background
**Pasos:** importar 50 tareas → monitorear Network DevTools y/o Vercel Functions logs

**Esperado:**
- La response al usuario llega inmediatamente (`fire-and-forget`)
- Las peticiones a `/api/embed` se disparan en batches de 5 con delay de 3s entre batches (no las 50 en ráfaga)
- A los ~30 segundos: todas las tareas tienen `task_embeddings` generado
- Ninguna petición recibe 429 del rate limiter de Voyage (100/min)

---

### CSV-13 — UTF-8 BOM no rompe parsing
**Pasos:** subir CSV exportado desde Excel (que añade BOM `﻿` al inicio)

**Esperado:** el parser lo strippea; las columnas se reconocen correctamente

---

### CSV-14 — Campos con comas escapadas con comillas
**Pasos:** CSV con `title="Setup, Docker y MLflow",...`

**Esperado:** el title se preserva completo como `Setup, Docker y MLflow`, sin partir por la coma interna

---

## Smoke test de producción (10 casos críticos)

Ejecutar en orden antes de cualquier presentación o demo. Dura ~15 minutos.

- [ ] **AUTH**: Login con cuenta real → tablero carga con proyecto
- [ ] **KANBAN**: Crear tarea desde el tablero → aparece en columna "Por hacer"
- [ ] **DND**: Arrastrar tarea a "En progreso" → status actualizado en DB
- [ ] **CHAT-STREAM**: Preguntar "¿Cuántas tareas tengo pendientes?" → respuesta con stream visible token a token
- [ ] **TOOL-CREATE**: "Crea una tarea llamada 'Smoke test'" → aparece en tablero + board_update
- [ ] **CONFIRM**: "Elimina la tarea 'Smoke test'" → ConfirmCard aparece → confirmar → tarea desaparece
- [ ] **ANALYTICS**: KPIs en `/analytics` coinciden con conteo manual del tablero
- [ ] **PDF**: Exportar PDF → archivo descargado; secciones en mayúsculas sin markdown; nombre del proyecto correcto
- [ ] **SEGURIDAD**: `curl -I https://<URL>` muestra `x-frame-options: DENY` y `strict-transport-security`
- [ ] **TEMA**: Toggle claro/oscuro → recargar → tema persiste sin flash
- [ ] **CSV IMPORT**: Click "Borrar todo" → board muestra importador → subir `template-tareas.csv` → 10 tareas aparecen en columnas

---

## Tabla de dependencias de entorno

| Variable | Tests afectados | Sin ella |
|---|---|---|
| `GROQ_API_KEY` | CHAT-*, TOOL-*, CONFIRM-*, PDF-* | App no arranca (validación en `env.ts`) |
| `VOYAGE_API_KEY` | RAG-*, KANBAN-01 (embedding) | App no arranca |
| `SUPABASE_SERVICE_ROLE_KEY` | KANBAN-01 (trigger embed), SEC-02 | `/api/embed` siempre falla |
| `EMBED_INTERNAL_SECRET` | SEC-02, SEC-03 | HMAC siempre inválido |
| `UPSTASH_REDIS_REST_URL/TOKEN` | RL-01 a RL-04 | Rate limiting desactivado; RL tests son SKIP |
| `CRON_SECRET` | SEC-04, SEC-05 | Cron expuesto sin auth |
| `ANTHROPIC_API_KEY` | ERR-01 (fallback) | Fallback desactivado; SKIP ERR-01 |
| `RESEND_API_KEY` | INVITE-01 (email real) | Invitación sin email; URL solo en logs |
| `NEXT_PUBLIC_SENTRY_DSN` | SENTRY-01 a 03 | Eventos no llegan a Sentry; SKIP sección 21 |
| Migración 006 | CHAT-02, CHAT-03 | BLOCKED |
| Migración 007 | KANBAN-07, DRAWER-02/03, REALTIME-*, INVITE-*, PROJECT-03 | BLOCKED |
| Migración 008 | Toda la sección 16 | BLOCKED |
| Migración 010 | REALTIME-01, REALTIME-02 | BLOCKED |
