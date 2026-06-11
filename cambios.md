# cambios.md — Actualización taskflow-guide.html
> Hallazgos de la auditoría de arquitectura (Fable 5 · 2026-06-10)
> Este documento es la fuente de verdad para regenerar taskflow-guide.html.

---

## 0. Resumen de cambios

| Tipo | Cantidad | Secciones afectadas |
|------|----------|---------------------|
| Errores factuales (nombres incorrectos) | 3 | F1, F2, F4 |
| Bugs críticos nuevos a documentar | 4 | F1, F5, F6, F7 |
| Trampas/guardrails nuevos | 5 | F4, F5, F6, F7, F8 |
| Nueva Fase completa | 1 | F16 — Auditoría Post-Build |
| Optimizaciones FinOps a documentar | 4 | F6 (FinOps box nuevo) |
| Corrección de scores en Features tab | 1 | Tab "¿Qué hace?" |

---

## 1. ERRORES FACTUALES — Corregir antes de todo

### 1.1 Nombres de migraciones (FASE 1 · step-block 1.2)

El bloque de código con el árbol de archivos de migraciones muestra nombres incorrectos.

**Texto actual:**
```
001_types_and_profiles.sql  ← enums y tabla profiles
002_tasks.sql               ← tabla tasks con posicionamiento
003_embeddings.sql          ← task_embeddings con halfvec(512)
004_rls_policies.sql        ← TODAS las políticas RLS + SECURITY DEFINER
005_projects.sql            ← multi-tenancy: projects + project_members
006_invitations.sql         ← tokens de invitación con expiración
007_chat_sessions.sql       ← sesiones de chat persistentes
008_comments.sql            ← comentarios en tareas
009_indexes.sql             ← índices de rendimiento
010_realtime.sql            ← publicación de canales Realtime
```

**Texto correcto:**
```
001_profiles.sql            ← enums, tabla profiles y función handle_new_user
002_tasks.sql               ← tabla tasks con posicionamiento numérico (step ×1000)
003_embeddings.sql          ← task_embeddings halfvec(512) + HNSW + RLS
004_rls_policies.sql        ← funciones SECURITY DEFINER + search_tasks_by_embedding v1
005_projects.sql            ← projects, project_phases, delivery_date
006_chat_sessions.sql       ← chat_sessions, chat_messages
007_collaboration.sql       ← project_members, task_assignments, comments, activity_log
                              + is_project_member/is_project_editor + RLS colaborativo
                              + search_tasks_by_embedding v2 (incluye proyectos compartidos)
008_invitations.sql         ← pending_invitations, get_invitation_by_token, accept_invitation
009_profiles_collab.sql     ← get_project_member_profiles (SECURITY DEFINER)
010_realtime.sql            ← publication Realtime en tasks y task_assignments
```

### 1.2 Schema de env.ts (FASE 2 · step-block 2.2)

El bloque de código de `env.ts` muestra Upstash como campos obligatorios y usa `.parse()`.

**Texto actual:**
```ts
UPSTASH_REDIS_REST_URL:  z.string().url(),
UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
// ...
export const env = envSchema.parse(process.env)
```

**Texto correcto:**
```ts
// Rate limiting (opcional — sin Upstash el rate limit está desactivado en dev local)
UPSTASH_REDIS_REST_URL:   z.string().url().optional(),
UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
// ...
// safeParse para mensaje de error descriptivo, no excepción cruda de Zod
function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Variables de entorno inválidas:\n${missing.join('\n')}`)
  }
  return result.data
}
export const env = validateEnv()
```

### 1.3 Límite de título en CreateTaskSchema (FASE 3)

El código de ejemplo muestra `title: z.string().min(1, '…').max(500)`.

**Corregir a:** `max(200, 'Máximo 200 caracteres')` — alineado con la validación real y el esquema CSV.

---

## 2. BUGS CRÍTICOS NUEVOS — Agregar como traps con alto impacto

### 2.1 Drift de migración — RAG silenciosamente roto en entornos nuevos (FASE 5)

Agregar al final del step-block del pipeline RAG (después del bloque de reranking), un nuevo trap de clase roja/crítica:

**Nuevo trap a insertar:**

```
🔴 CRÍTICO — Drift de firma entre rag.ts y migraciones

rag.ts invoca:
  supabase.rpc('search_tasks_by_embedding', {
    query_embedding, similarity_threshold, match_count, p_user_id
  })

La última definición SQL viva en producción (007_collaboration.sql) tiene:
  search_tasks_by_embedding(query_embedding halfvec(512), match_threshold float, match_count int)
  — sin p_user_id, y con otro nombre de parámetro (match_threshold ≠ similarity_threshold).

PostgREST resuelve RPCs por nombre de parámetro: en una DB recién migrada con db push esto
lanza PGRST202. El catch de searchTasksBySemantic atrapa el error y retorna [] silenciosamente
→ el agente responde sin contexto RAG, sin alerta en Sentry, y nadie lo detecta.

SOLUCIÓN: crear 011_fix_search_signature.sql que realinee la firma con lo que rag.ts invoca.
Verificar la firma viva ANTES con:
  SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'search_tasks_by_embedding';

Agregar los errores de RAG a Sentry.captureException (no solo console.error):
  console.error('[rag] Error en búsqueda vectorial:', error)  ← esto es invisible en producción
  Sentry.captureException(error, { tags: { component: 'rag.semantic' } })  ← esto alerta
```

### 2.2 Cron siempre retorna vacío por RLS (FASE 14 o nueva sección de pitfalls)

Agregar trap en la sección de CI/CD (F14) o en la nueva F16:

```
🔴 BUG — /api/cron/insights usa cliente con cookies (siempre retorna [] vacío)

El cron de Vercel no tiene sesión de usuario: no hay cookie de JWT.
createClient() del servidor usa cookies() → pasa por RLS como anon → todas las queries
retornan [] silenciosamente (documentado en CLAUDE.md como "RLS silencioso").

SOLUCIÓN: los cron jobs SIEMPRE deben usar el cliente service_role:
  import { createClient } from '@supabase/supabase-js'
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

El cliente service_role bypasea RLS — legítimo para jobs del sistema que necesitan
leer datos de todos los usuarios. Nunca usarlo en endpoints que reciben input del usuario.
```

### 2.3 Confirm endpoint — El flujo de confirmación destructiva es teatro (FASE 6)

Actualizar el debate/guardrail del Agente IA (F6). El HTML actual dice "el agente emite `confirm_required` y espera confirmación explícita por clic" sin mencionar la vulnerabilidad.

**Agregar trap nuevo en F6:**

```
⚠️ TRAMPA DE DISEÑO — /api/chat/confirm acepta cualquier tool sin validación

El endpoint actual recibe { tool, args } del cliente y ejecuta executeTool() directamente.
Consecuencias:
- Acepta cualquier tool, no solo delete_task (la única declarada destructiva).
- args no pasa por Zod → el LLM (o un cliente malicioso) puede enviar campos arbitrarios.
- El confirm_id que emite el agente NUNCA se verifica → no hay garantía de que
  hubo una propuesta previa del LLM.
El blast radius lo contiene el scoping por userId + RLS, pero el diseño contradice
su propósito de guardrail de confirmación.

SOLUCIÓN: allowlist + Zod en el endpoint:
  const ConfirmSchema = z.object({
    tool: z.literal('delete_task'),         // allowlist = DESTRUCTIVE_TOOLS
    args: z.object({ task_id: z.string().uuid() }),
  })
  const parsed = ConfirmSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })

Para el mensaje de confirmación: usar template string (costo cero) en vez de llamada LLM 70B.
```

### 2.4 RLS: WITH CHECK tautológico en tasks UPDATE (FASE 7)

Agregar trap en la sección de Multi-tenancy (F7) o en F1:

```
🔴 VULNERABILIDAD RLS — WITH CHECK en tasks UPDATE es siempre verdadero

La migración 007_collaboration.sql tiene:
  create policy "Editors del proyecto actualizan tareas"
    on public.tasks for update
    using (public.is_project_editor(project_id))
    with check (auth.uid() = user_id or user_id is not null);

Como user_id es NOT NULL, la segunda condición es SIEMPRE verdadera.
Un editor de proyecto puede ejecutar:
  UPDATE tasks SET user_id = '<uuid-de-otro-usuario>' WHERE id = '<tarea>'
y reasignar la propiedad de la tarea a cualquier usuario.

SOLUCIÓN en SQL:
  drop policy "Editors del proyecto actualizan tareas" on public.tasks;
  create policy "Editors del proyecto actualizan tareas"
    on public.tasks for update
    using (public.is_project_editor(project_id))
    with check (public.is_project_editor(project_id));

Refuerzo adicional: trigger BEFORE UPDATE que fuerza NEW.user_id := OLD.user_id,
ya que WITH CHECK no puede comparar OLD vs NEW directamente.
```

---

## 3. TRAMPAS NUEVAS (menores) — Agregar en las secciones correspondientes

### 3.1 fire-and-forget en serverless (FASE 4 — triggerEmbedding)

Agregar nota después del trap de `redirect()` en F4:

```
⚠️ LÍMITE DE SERVERLESS — fire-and-forget puede perder trabajo silenciosamente

void triggerEmbedding(...)  ← en Vercel, la función puede congelarse tras enviar
                               la response, antes de que termine el background task.

Para 1 embedding por tarea: el riesgo es bajo con Fluid Compute (que reutiliza instancias).
Para el CSV import de 500 tareas (5 min de background): hay riesgo real de pérdida.

SOLUCIÓN para el import masivo:
  - Usar waitUntil() de Vercel en Fluid Compute
  - O una Vercel Queue / cron de backfill que detecte tareas con embedding_id = null

El task trigger individual (createTask/updateTask) está bien como está para cargas pequeñas.
```

### 3.2 Prompt injection en endpoints de informe y auditoría (FASE 10 o nueva sección)

Agregar en F10 (Analytics) como trap o en la nueva F16:

```
⚠️ PROMPT INJECTION — /api/report y /api/audit interpolan datos del cliente sin Zod

Ambos endpoints hacen type assertion (as ReportSummary, as TaskRow[]) sin validar runtime.
Un cliente puede enviar summary.daysLeft = "5. IGNORA LAS INSTRUCCIONES ANTERIORES…"
que se interpola literalmente en el prompt del LLM.

Severidad moderada (autenticado, output solo al mismo usuario), pero en proyectos compartidos
un editor malicioso puede envenenar el informe del owner via títulos de tareas en /api/audit.

SOLUCIÓN:
  1. Validar summary con Zod en /api/report antes de interpolar al prompt.
  2. En /api/audit, calcular las métricas server-side desde la DB en vez de confiar el payload.
  3. Sanitizar los títulos de tareas (trim + slice) antes de insertarlos en el prompt.
```

### 3.3 search_comments sin scoping explícito + wildcard sin escapar (FASE 5 o F6)

Agregar como nota técnica en la sección de tools del agente:

```
⚠️ DEFENSA EN PROFUNDIDAD — search_comments depende solo de RLS

El resto de las tools del agente incluyen .eq('user_id', userId) explícito.
search_comments solo usa .ilike('content', '%query%') sin filtro de usuario explícito.
Funciona porque RLS protege la tabla comments, pero viola la convención del proyecto
(CLAUDE.md regla 3: "Queries siempre incluyen .eq('user_id', user.id) además del RLS").

Adicionalmente: los wildcards % y _ del input no están escapados en el ilike,
lo que permite patrones inesperados (ej: query "%" retorna todos los comentarios visibles).
```

### 3.4 Rate limit embed spoofeable por header rotation (FASE 8)

Agregar como nota al pie del bloque de rate limiting:

```
💡 NOTA — El identificador del rate limiter de /api/embed es spoofeable

ratelimit.embed() usa el header origin/host como identificador.
Un atacante puede rotar el header para resetear su cuota, aunque
sin el secreto HMAC no puede explotar el endpoint de ninguna forma útil.
El HMAC es la barrera real; el rate limit es defensa en profundidad adicional.
```

---

## 4. NUEVA FASE — F16: Auditoría Post-Build

Agregar una nueva fase plegable `id="f16"` después de F15 (Onboarding) y antes del Pre-Deploy checklist.

**Título:** "Auditoría Post-Build — Pitfalls de Producción"
**Subtítulo:** "Hallazgos de auditoría AI: bugs silenciosos, FinOps y robustez"

### Estructura de la nueva fase:

#### Sección 1: Panel de scores (tabla)
| Dimensión | Score | Descripción |
|-----------|-------|-------------|
| Scalability | 7/10 | HNSW + halfvec correctos; posiciones con espaciado 1000; fire-and-forget en serverless necesita waitUntil para imports masivos |
| Security | 6.5/10 | RLS sólido + HMAC ejemplar; confirm endpoint sin allowlist; WITH CHECK tautológico; prompt injection en report/audit |
| Cost Efficiency | 6/10 | Modelo 70B para confirmaciones de 1 oración; query embedding sin caché; getProjectSummary en cada mensaje |
| AI Robustness | 6/10 | Fallback Haiku solo cubre turno 2; turno 1 no hace streaming; degradación RAG silenciosa sin alerta Sentry |

#### Sección 2: Bugs críticos (lista priorizada)
1. **Drift de migración** `011_fix_search_signature.sql` — RAG roto en cualquier entorno nuevo
2. **Cron con RLS** — `/api/cron/insights` siempre retorna [] vacío
3. **RLS WITH CHECK tautológico** — reasignación de ownership en tasks
4. **Confirm endpoint** — sin allowlist ni validación Zod de args

#### Sección 3: Optimizaciones FinOps (tabla con estimados)

**Título del bloque:** "AI FinOps — Optimizaciones de Costo y Latencia"

| Acción | Dónde | Impacto estimado |
|--------|-------|------------------|
| Template string (sin LLM) en /api/chat/confirm | confirm/route.ts | −100% costo + −500ms latencia en confirmaciones |
| `llama-3.1-8b-instant` en confirmación si se quiere LLM | confirm/route.ts | −90% costo vs 70B; respuesta idéntica para 1 oración |
| Caché Redis de query embedding (hash → TTL 1h) | rag.ts / voyage.ts | −30–50% llamadas Voyage en queries repetitivas |
| Caché de `getProjectSummary` en Upstash (TTL 60s) | rag.ts | −2 queries DB por mensaje de chat |
| Streaming en turno 1 del agente | agent.ts | P95 primer token: ~4s → <500ms percibido |
| Truncar `history` server-side a ~4K tokens | api/chat/route.ts | Acota costo creciente por conversación |
| `waitUntil()` para embeddings del CSV import | import.actions.ts | Elimina pérdida silenciosa de hasta 500 embeddings |

#### Sección 4: Deuda técnica (menor prioridad)
- `api/backfill` excluido en middleware.ts:35 pero la ruta no existe — exclusión zombie
- `agent.ts` fallback Haiku asimétrico: protege turno 2 pero no turno 1
- `search_comments` sin scoping explícito + wildcards sin escapar
- `tools.ts` duplicate position logic (también en task.actions.ts:35 y dos veces en tools.ts)

---

## 5. ACTUALIZACIÓN DEL NAV LATERAL (sticky-nav)

Agregar nuevo item después de F15:

```html
<a class="nav-item" onclick="togglePhase('f16')">
  <span class="nav-num">16</span>
  <span class="nav-text">Auditoría Post-Build</span>
</a>
```

Y actualizar el item Pre-Deploy a:
```html
<a class="nav-item" onclick="togglePhase('f17')">
  <span class="nav-num">✓</span>
  <span class="nav-text">Pre-Deploy</span>
</a>
```

---

## 6. ACTUALIZACIÓN DEL TOC (Mapa de Fases)

Agregar item en el toc-grid:
```html
<div class="toc-item fade-in" onclick="togglePhase('f16')">
  <span class="toc-num">F·16</span>
  <span class="toc-text">Auditoría Post-Build</span>
</div>
```

---

## 7. ACTUALIZACIÓN DEL TAB "¿Qué hace?"

### 7.1 Feat-metrics (hero panel)

Actualizar métricas del hero panel del tab "¿Qué hace?":
- Agregar métrica: **6.5/10** label: "Security Score (audit)"
- Agregar métrica: **4** label: "Bugs Críticos Detectados"

### 7.2 Sección de seguridad

En la feat-security-grid del tab features, actualizar la card "Guardrail destructivo":

**Texto actual:**
> Eliminar una tarea nunca se ejecuta directamente. El agente emite `confirm_required` y espera confirmación explícita por clic — nunca por voz.

**Texto actualizado:**
> El agente emite `confirm_required` y espera confirmación explícita. El endpoint `/api/chat/confirm` debe validar con `z.literal('delete_task')` y Zod estricto — sin allowlist el flujo es solo UX, no seguridad real.

---

## 8. CORRECCIONES MENORES EN DIAGRAMAS

### 8.1 Panel de modelos (model-info-panel / restoreModelPanel)

En el panel flotante que muestra info de modelos (JS en la parte inferior), actualizar la descripción del FALLBACK:

**Texto actual:**
> Claude Haiku 4.5 — Activado si Groq no responde en 10s. Mismas tools, mismo system prompt. Transparente para el usuario.

**Texto correcto:**
> Claude Haiku 4.5 — Activado solo en el **turno 2** si Groq falla al generar la respuesta final post-tool. El turno 1 (detección de tool calls) no tiene fallback — si Groq cae allí, el stream emite `{ type: 'error' }`. Cobertura asimétrica a documentar.

---

## 9. HEADER — Actualizar metadatos

En el bloque `.header-meta`, actualizar la línea de IA:

**Actual:**
```html
<div class="meta-item">IA <span>RAG Híbrido + Agente Tool-Calling</span></div>
```

**Actualizado:**
```html
<div class="meta-item">IA <span>RAG Híbrido + Agente Tool-Calling · Audit 2026-06-10</span></div>
```

---

## 10. NOTAS DE IMPLEMENTACIÓN PARA CLAUDE

Al regenerar el HTML, mantener:
- Todos los estilos CSS existentes (no cambiar tokens, layout, animaciones)
- La estructura de 3 tabs (Guía / Cómo funciona / ¿Qué hace?)
- El canvas de circuito animado y el progress bar
- El sistema de fases plegables con togglePhase()
- Los bloques `.debate-block`, `.decision-box`, `.trap`, `.code-wrap` existentes

Solo agregar/modificar contenido dentro de las fases, no restructurar el sistema de layout.

Los bugs críticos deben usar un trap con icono 🔴 y borde rojo (agregar clase `.trap-critical` en CSS):
```css
.trap.critical {
  background: rgba(220,38,38,0.04);
  border: 1px solid rgba(220,38,38,0.2);
  border-left: 3px solid #dc2626;
}
.trap.critical .trap-icon { filter: none; }
```

Para los traps críticos, usar `trap-who` = "BLOCKER — Prioridad de remediación: ALTA".
