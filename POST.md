# Posts profesionales — TaskFlow AI

> Tres opciones listas para publicar. Reemplaza `<TU-URL>`, `<TU-REPO>` y los placeholders de imagen antes de publicar.

---

## Opción 1 — LinkedIn / X (corto, hook fuerte)

> **Tono:** primera persona, decisión técnica como gancho, diagrama como prueba. ~1.200 caracteres.

---

Construí un SaaS de gestión de tareas donde el chatbot no responde sobre las tareas — las ejecuta. Y documenté cada decisión técnica en una guía interactiva con diagramas de proceso animados.

**Lo que el agente hace por texto y por voz:**
→ Crea tareas en el tablero
→ Las mueve entre columnas (todo → in progress → done)
→ Las elimina — con confirmación obligatoria antes de ejecutar

**Las 4 decisiones que más importaron:**

→ **Guardrail antes del servidor.** `delete_task` emite `confirm_required` por SSE y pausa. El LLM nunca borra sin que el usuario confirme con clic — tampoco por voz.

→ **RAG híbrido, no solo embeddings.** "¿Qué tengo pendiente?" necesita SQL, no semántica. El pipeline detecta intención estructural primero, luego vectores, luego reranking con Voyage AI. Top-20 → top-5.

→ **Optimistic UI en el Kanban.** El cambio se ve en pantalla antes de que el servidor responda. Si la acción falla, `useOptimistic` revierte automáticamente — sin código manual.

→ **Supabase RLS como backend real.** Las políticas se evalúan fila por fila en cada query. No hay API layer intermedio — para CRUD simple, ya existe.

**Stack:** Next.js 16 · React 19 · TypeScript strict · Supabase · Groq + Claude Haiku 4.5 (fallback) · Voyage AI · Upstash · Sentry · Vercel.

**Calidad:** 82% statements · 73% branches · 6 specs E2E · 0 warnings ESLint · 0 errores TypeScript.

Guía técnica interactiva con diagramas de proceso: `<TU-URL>`
Código: `<TU-REPO>`

#NextJS #Supabase #AI #RAG #TypeScript #FullStack

---
---

## Opción 2 — Portfolio técnico / GitHub showcase (estructurado)

> **Tono:** documentación de producto. Muestra el sistema completo: producto + guía + diagramas. Para reclutadores técnicos y CTOs.

---

# TaskFlow AI

> SaaS de productividad colaborativa donde el chatbot actúa sobre las tareas — crea, mueve y elimina en lenguaje natural o por voz.

[![CI](https://github.com/<usuario>/<repo>/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/<usuario>/<repo>/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)
[![Coverage](https://img.shields.io/badge/coverage-82%25-success)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

**Demo:** [`<TU-URL>`](<TU-URL>) · **Repo:** [`<TU-REPO>`](<TU-REPO>) · **Guía técnica:** [`<URL-GUIA>`](<URL-GUIA>)

![TaskFlow AI — demo](docs/hero.gif)

---

## Qué hace

El agente entiende el contexto del proyecto y actúa sobre él:

- **"Crea una tarea de alta prioridad para revisar el dashboard mañana"** → tarea creada en el tablero
- **"Mueve la tarea de integración a completado"** → columna cambiada, todos los miembros lo ven en tiempo real
- **"Elimina la tarea de onboarding"** → el agente pausa, muestra el nombre de la tarea y espera confirmación explícita del usuario antes de ejecutar
- **Todo lo anterior por voz** → Web Speech API transcribe, el agente procesa, TTS lee la respuesta en español colombiano

## Flujo del agente (simplificado)

```
Texto / 🎤 Voz (es-CO)
        ↓
POST /api/chat → Bot Guard → Auth → Rate limit 20/min
        ↓
RAG híbrido: intención estructural + vector + rerank-2-lite → top-5 tareas
        ↓
Groq llama-3.3-70b (tool calling) — Fallback: Claude Haiku 4.5
        ↓
SSE stream → token / tool_call / tool_result / confirm_required / sources / board_update
        ↓
Chat UI actualiza · 🔊 TTS si voz · Tablero recarga si hubo acción
```

→ Diagrama interactivo animado completo en la guía técnica

## Decisiones de arquitectura

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Supabase RLS como backend | API layer separado | Las políticas se evalúan fila por fila — no se necesita intermediario para CRUD |
| `runtime = 'nodejs'` en `/api/chat` | Edge Runtime | SSE largo + loops de tool calling + múltiples APIs externas rompen Edge |
| `getUser()` en middleware | `getSession()` | `getSession()` no valida JWT contra el servidor |
| `halfvec(512)` + HNSW | `vector(1536)` + IVFFLAT | 50% menos espacio; HNSW funciona desde la primera fila sin entrenamiento |
| RAG híbrido (intención + vector) | Solo embeddings | "Pendiente" es estado, no semántica — SQL gana en consultas estructurales |
| `confirm_required` SSE event | Ejecutar y deshacer | Acciones destructivas requieren consentimiento informado, no rollback |
| Funciones `SECURITY DEFINER` | Políticas RLS con JOIN directo | Evita recursión entre tablas en multi-tenancy |
| HTML export con `buildAnalyticsHTML` | PDF con canvas | Tailwind v4 usa `oklch()` — canvas produce colores incorrectos |
| Build prebuilt en Vercel | Rebuild en Vercel | Lo que CI testea es exactamente lo que se deploya |

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript strict |
| Auth & DB | Supabase (RLS + pgvector `halfvec(512)`) |
| LLM | Groq `llama-3.3-70b-versatile` + Claude Haiku 4.5 (fallback) |
| Embeddings | Voyage AI `voyage-3-lite` (512 dims) + `rerank-2-lite` |
| UI | Tailwind CSS v4, shadcn/ui, @dnd-kit |
| Voz | Web Speech API (es-CO) + SpeechSynthesisUtterance (rate 1.1) |
| Rate limiting | Upstash Redis · 20/min chat · 5/min report · 100/min embed |
| Observabilidad | Sentry `@sentry/nextjs` v10 con eventos custom |
| Informe HTML | `buildAnalyticsHTML` (dark, self-contained, sin canvas) |
| Tests | Vitest (82% statements) + Playwright (6 specs E2E) |
| Deploy | Vercel Fluid Compute + GitHub Actions + Lighthouse CI |

## Guía técnica interactiva

El proyecto incluye una guía de construcción con dos pestañas:

**"Guía de Construcción"** — 16 fases de debate entre tres expertos (seguridad, IA/ML, full-stack). Cada decisión tiene el razonamiento completo, el código exacto y las trampas que evitar.

**"Cómo funciona"** — 4 diagramas de proceso interactivos:
- D·1 El Agente — de tu mensaje a la acción (flujo completo con voz)
- D·2 RAG Híbrido — cómo el agente encuentra tus tareas
- D·3 Modo Voz — dictado y respuesta hablada en es-CO
- D·4 Kanban — drag & drop optimista + tiempo real

Cada nodo del diagrama tiene tooltip explicativo. Los nodos de IA abren un panel con el modelo exacto usado. Cada diagrama tiene animación secuencial que recorre el flujo paso a paso.

## Voces del equipo

> *"RLS mal configurado no lanza error — retorna silencio. Ese silencio es la brecha."*  
> — **Diego Vargas**, Seguridad & Plataforma

> *"Un agente sin guardrails no es IA — es superficie de ataque con contexto."*  
> — **Valentina Torres**, IA/ML & Sistemas RAG

> *"Si el TypeScript compila con `any`, el problema no es TypeScript."*  
> — **Sebastián Mora**, Full-Stack & Calidad

## Métricas

- **82%** statements · **73%** branches · **6/6** E2E specs
- **0** warnings ESLint · **0** errores TypeScript strict
- **10 migraciones SQL** idempotentes con RLS completo
- **LCP < 2.5 s** como budget en Lighthouse CI

## Cómo correrlo

```bash
git clone <TU-REPO>
cd taskflow-v3
npm install
cp .env.example .env.local   # Supabase, Groq, Voyage AI, Upstash
npm run dev
```

Migraciones en `supabase/migrations/` (001→010) — aplicar en orden via Dashboard SQL Editor o `npx supabase db push`.

## Licencia

MIT

---
---

## Opción 3 — Blog técnico / Dev.to / Medium (narrativa)

> **Tono:** historia de construcción. La guía con diagramas como hilo conductor. ~1.800 palabras.

---

# TaskFlow AI: construí el producto y la guía que explica cada decisión técnica

**TL;DR:** SaaS de gestión de tareas con un agente que actúa en lenguaje natural y por voz. RAG híbrido, guardrails para destructivas, multi-tenancy con RLS, Kanban colaborativo en tiempo real. 82% de cobertura de tests. Documentado en una guía interactiva con 4 diagramas de proceso animados. Este post explica las decisiones que más cambiaron el diseño.

---

## Por qué documentar con diagramas, no solo con README

Cuando terminé el producto tenía dos problemas: el código funcionaba, pero explicar cómo interactuaban las piezas era difícil en texto plano.

La solución fue construir una guía técnica interactiva — un HTML self-contained con dos pestañas:

- **"Guía de Construcción"**: 16 fases, tres expertos debatiendo cada decisión, código exacto y trampas documentadas
- **"Cómo funciona"**: 4 diagramas de proceso con nodos clickeables, tooltips explicativos, animación secuencial y un panel lateral que muestra el modelo de IA exacto detrás de cada nodo

El resultado: cualquier developer puede entender el flujo completo — desde que el usuario habla hasta que el tablero cambia — sin leer código.

---

## El flujo que más costó diseñar: voz → agente → acción → voz

El modo voz no es una capa de grabación encima del chat. Es el mismo pipeline completo:

```
1. Usuario presiona 🎤
2. Web Speech API escucha en es-CO (español colombiano, continuous:false)
3. Transcript capturado → sendMessage(text, voiceMode=true)
4. El flag voiceMode=true cambia el comportamiento del LLM:
   - respuesta corta (máximo 2 oraciones)
   - sin markdown (TTS no puede leer asteriscos)
   - lenguaje conversacional ("Listo, creé la tarea" no "Tarea creada exitosamente")
5. Respuesta llega por SSE token a token
6. SpeechSynthesisUtterance lee la respuesta · es-CO · rate: 1.1
7. Si el agente ejecutó una acción, el tablero se actualiza
```

Crear una tarea por voz funciona completo. Mover de estado funciona completo. Eliminar también — con una restricción intencional: `delete_task` emite `confirm_required` y pausa. El usuario debe confirmar con **clic**. Una acción destructiva no se puede confirmar con otra frase que el LLM podría malinterpretar.

---

## La decisión de arquitectura más importante: RAG híbrido

El primer prototipo usaba solo búsqueda vectorial. Cuando el usuario preguntaba "¿qué tengo pendiente?", los resultados eran inconsistentes — "pendiente" es un estado, no semántica.

El pipeline correcto detecta intención primero:

```
Query → detectStructuralIntent() [regex]
  ↓
¿Hay intención estructural? (status, priority, fecha)
  SÍ → SQL directo + vector en paralelo → merge deduplicado
  NO → solo búsqueda vectorial

Top-20 candidatos → rerank-2-lite (Voyage AI) → top-5
Fallback: si rerank falla → top-5 por score embedding
```

El reranking con `rerank-2-lite` re-ordena los candidatos por relevancia léxica — más preciso que cosine similarity para textos cortos como títulos de tareas. El fallback graceful (top-5 sin reordenar) es invisible para el usuario si Voyage Rerank no responde.

---

## El guardrail que impide que el agente se vuelva destructivo

```typescript
const DESTRUCTIVE_TOOLS = new Set(['delete_task'])

if (DESTRUCTIVE_TOOLS.has(toolName)) {
  emit(controller, {
    type: 'confirm_required',
    tool: toolName,
    args,
    task_title: data?.title ?? null,
    confirm_id: crypto.randomUUID(),
  })
  return  // el servidor para aquí
}
```

Cuando el LLM decide llamar a `delete_task`, el servidor no ejecuta. Emite `confirm_required` con el título de la tarea. El cliente renderiza una `ConfirmCard` con el nombre exacto. Solo si el usuario confirma se hace `POST /api/chat/confirm`.

El sistema de herramientas es mínimo por diseño: 6 tools (crear, actualizar, mover, eliminar, buscar tareas, buscar comentarios). Cada tool que se añade es más superficie de prompt injection.

---

## El Kanban que no espera al servidor

Con `useOptimistic`, el cambio se ve en pantalla antes de que el servidor responda:

```
1. Usuario arrastra tarea entre columnas
2. applyOptimisticMove() → cambio INMEDIATO en pantalla
3. startTransition() → moveTask() Server Action en background
4. ¿Éxito?
   SÍ → persiste en Supabase → Realtime notifica a otros miembros
   NO → useOptimistic revierte automáticamente
```

La deduplicación con Supabase Realtime requiere un skip explícito: si `record.user_id === currentUserId`, ignorar el evento. Los cambios propios ya están aplicados optimistamente — si el Realtime los re-aplica, hay un flash visible.

---

## RLS: el error que retorna silencio

El error más costoso en Supabase no lanza excepción. Lanza un array vacío.

Si una política RLS está mal configurada, `SELECT` retorna `[]` sin error. La aplicación "funciona" en staging y filtra datos reales en producción sin que nadie lo note.

Para multi-tenancy con tres roles (owner / editor / viewer), las políticas necesitan verificar membresía. Pero las tablas de miembros también tienen RLS — la recursión produce timeouts.

La solución son funciones `SECURITY DEFINER`:

```sql
CREATE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  )
$$;
```

La función se ejecuta con permisos del owner, saltando RLS dentro de ella. La política queda en una línea. El protocolo de verificación: insertar con `service_role`, consultar con `anon_key` → debe retornar `[]`, consultar con JWT correcto → debe retornar datos.

---

## Tres trampas que no están en la documentación oficial

**`getSession()` en middleware.** Lee el JWT del cookie sin validarlo contra el servidor — un token manipulado pasa. La única verificación correcta es `getUser()`.

**`redirect()` dentro de try/catch.** Next.js lanza una excepción internamente para interrumpir la ejecución. Si la pones dentro de un `try/catch`, el catch la captura y el redirect nunca ocurre.

**Zod v4 cambió `.errors` a `.issues`.** Si usas `parsed.error.errors[0].message` en Server Actions obtienes `undefined` silenciosamente — el mensaje de error se pierde sin que nada explote.

---

## Lo que aprendí

1. **El silencio de RLS es la brecha.** Un array vacío puede ser correcto o puede ser un leak — la diferencia es invisible sin pruebas explícitas con distintos niveles de acceso.

2. **El diagrama de proceso es parte del producto.** No es documentación accesoria — es la forma más rápida de que otro developer entienda una decisión de arquitectura sin leer código durante 30 minutos.

3. **El guardrail técnico y el guardrail de UX se complementan.** `DESTRUCTIVE_TOOLS` en el servidor impide la ejecución. `ConfirmCard` en el cliente hace visible el riesgo. Las reglas negativas en el system prompt instruyen al LLM. Tres capas independientes.

4. **El rate limit del embed no es el del chat.** Voyage AI, Groq y Upstash tienen límites distintos porque las operaciones cuestan distinto. El límite del endpoint de embed (100/min) existe precisamente para no saturar el backfill de embeddings.

---

**Guía técnica interactiva:** [`<URL-GUIA>`](<URL-GUIA>)  
**Demo:** [`<TU-URL>`](<TU-URL>)  
**Código:** [`<TU-REPO>`](<TU-REPO>)

---

## Cómo elegir

| Canal | Opción | Por qué |
|---|---|---|
| LinkedIn / X / Newsletter | **1** | Hook directo en la primera línea, decisiones en bullets, link a la guía al final |
| Portfolio / GitHub README | **2** | Tabla de decisiones, stack completo, sección dedicada a la guía y los diagramas |
| Dev.to / Medium / blog | **3** | Narrativa por decisiones, código real, la guía aparece como hilo conductor desde el primer párrafo |

Las tres son complementarias: la **1** para anunciar, la **2** como README del repo, la **3** como deep-dive técnico una semana después del lanzamiento.
