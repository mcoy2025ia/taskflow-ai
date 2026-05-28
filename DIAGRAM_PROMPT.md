# Prompt para Claude — Diagrama de procesos en taskflow-guide-mcoy.html

## Tarea

Tienes el archivo `taskflow-guide-mcoy.html`. Agrégale una **segunda pestaña** llamada **"Cómo funciona"** que contenga diagramas de proceso interactivos. El objetivo es que cualquier persona entienda visualmente cómo TaskFlow AI procesa cada acción.

---

## Dónde insertar el sistema de pestañas

Inmediatamente después del cierre de `</header>` y antes de `<section class="experts-section">`, inserta el sistema de tabs. El contenido de los expertos y las fases existentes pasa a ser la pestaña **"Guía de Construcción"**. La nueva pestaña es **"Cómo funciona"**.

El wrapper de ambas pestañas debe quedar así conceptualmente:

```
[HEADER existente — no tocar]
[TAB BAR: "Guía de Construcción" | "Cómo funciona"]
[TAB CONTENT 1: todo el contenido existente (experts + toc + phases + summary + footer)]
[TAB CONTENT 2: los diagramas nuevos]
```

---

## Sistema de pestañas — CSS y JS

Usa las variables CSS ya definidas en el `<head>` del archivo. No importes librerías externas — el HTML debe seguir siendo self-contained.

```css
/* Tab bar */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 16px 0 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
}

.tab-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--slate-400);
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: var(--r-sm) var(--r-sm) 0 0;
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  color: var(--blue-glow);
  background: var(--carbon);
  border-color: var(--border);
  border-bottom-color: var(--carbon); /* "merge" con el contenido */
}

.tab-content { display: none; }
.tab-content.active { display: block; }
```

JS mínimo para el switcher:
```js
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  document.getElementById('tab-' + id).classList.add('active')
  document.querySelector('[data-tab="' + id + '"]').classList.add('active')
}
// Activar primera pestaña al cargar
document.querySelector('.tab-btn').classList.add('active')
document.querySelector('.tab-content').classList.add('active')
```

---

## Contenido de la pestaña "Cómo funciona"

Contiene **4 diagramas**, cada uno en su propia sección colapsable (misma mecánica de `togglePhase` que ya existe). Al cargar, el primero aparece abierto.

---

### Diagrama 1 — Flujo completo del Chat con IA

Título: `El Agente — De tu mensaje a la acción`
Subtítulo: `Desde que escribes o hablas hasta que el tablero cambia`

Muestra este flujo de izquierda a derecha (o top-down en mobile):

```
[ENTRADA]
  │
  ├─ Texto escrito  ──┐
  └─ 🎤 Voz (es-CO)  ─┤─→ sendMessage(text, voiceMode)
                       │
                    [POST /api/chat]
                       │
              ┌────────▼────────┐
              │   Guardianes    │
              │  Bot Guard      │
              │  Auth check     │
              │  Rate limit     │
              │  20 req/min     │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  Pipeline RAG   │  ← ver Diagrama 2
              │  top-5 tareas   │
              │  relevantes     │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │   Groq LLM      │
              │ llama-3.3-70b   │
              │  + tool calling │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
   [Sin tools]  [Tool no     [Tool DELETE]
          │     destructiva]        │
          │            │     confirm_required
          │       ejecutar          │  SSE → usuario
          │       paralelo          │  confirma clic
          │            │            │  POST /confirm
          │       Turno 2           │
          └─────────┬──┘            │
                    │◄──────────────┘
                [SSE stream al cliente]
                    │
          ┌─────────┼──────────┐
          │         │          │
        token   sources   board_update
          │         │          │
        Chat UI   Citas    router.refresh()
          │                    │
        🔊 TTS              Tablero
       (si voz)            actualizado
```

**Leyenda de colores para los nodos:**
- Azul brillante (`--blue-vivid`): acciones del usuario
- Azul medio (`--blue-bright`): endpoints y guardianes
- Azul hielo (`--blue-ice`): procesos de IA
- Plata (`--silver-hi`): base de datos y almacenamiento
- Verde suave (`#34d399`): resultado exitoso
- Ámbar (`#fbbf24`): confirmación requerida (destructivo)

---

### Diagrama 2 — Pipeline RAG (Búsqueda Semántica)

Título: `RAG Híbrido — Cómo el agente encuentra tus tareas`
Subtítulo: `Intención estructural + embeddings + reranking`

```
Query del usuario: "¿qué tengo pendiente?"
        │
        ▼
┌─────────────────────────┐
│  detectStructuralIntent │
│  regex: "pendiente"     │
│       → status: 'todo'  │
└────────────┬────────────┘
             │
      ¿Hay intención?
      /            \
    SÍ              NO
     │               │
┌────┴────┐    ┌─────┴──────┐
│SQL directo│   │Solo vector │
│+ vector   │   │            │
│en paralelo│   │            │
└────┬────┘    └─────┬──────┘
     │               │
     └───────┬────────┘
             │
     Merge + deduplicar
     (estructurales primero)
             │
        top-20 candidatos
             │
             ▼
┌────────────────────────┐
│   Voyage AI            │
│   rerank-2-lite        │
│   re-ordena por        │
│   relevancia léxica    │
└────────────┬───────────┘
             │
      ¿Rerank ok?
      /         \
    SÍ           NO (fallback)
     │               │
  top-5 reranked   top-5 por score
             │
             ▼
   Contexto → LLM (turno 1)
```

Nota explicativa debajo: *"El threshold de similarity empieza en 0.3 — con textos cortos como títulos de tareas, un score de 0.35 ya es relevante."*

---

### Diagrama 3 — Flujo de Voz

Título: `Modo Voz — Dictado y respuesta hablada`
Subtítulo: `Web Speech API + TTS en español colombiano`

Diagrama compacto, más visual que técnico. Pensado para usuarios finales:

```
1. Usuario presiona 🎤
        │
2. Web Speech API escucha
   Idioma: es-CO (español Colombia)
   continuous: false (una frase)
        │
3. Transcript capturado
   "crea tarea revisar el dashboard"
        │
4. Auto-submit → sendMessage(text, voiceMode=true)
        │
5. Agente procesa igual que texto
   El flag voiceMode=true le dice al LLM:
   → respuesta corta
   → sin markdown
   → lenguaje conversacional
        │
6. Respuesta llega por SSE (tokens)
        │
7. 🔊 TTS lee la respuesta
   SpeechSynthesisUtterance
   Voz: es-CO, rate: 1.1
        │
8. Tablero se actualiza si hubo acción
```

Resaltar con color ámbar: *"delete_task por voz emite confirm_required — el usuario debe confirmar con clic. Una acción destructiva nunca se confirma solo con voz."*

---

### Diagrama 4 — Flujo del Tablero Kanban

Título: `Kanban — Drag & drop optimista + tiempo real`
Subtítulo: `El cambio se ve antes de que el servidor responda`

```
Usuario arrastra tarea
        │
        ▼
┌───────────────────┐
│  applyOptimistic  │  ← cambio INMEDIATO en pantalla
│  Move (local)     │     sin esperar al servidor
└────────┬──────────┘
         │
  startTransition()
         │
         ▼
┌───────────────────┐
│  moveTask()       │  ← Server Action
│  (en background)  │
└────────┬──────────┘
         │
    ¿Éxito?
    /       \
  SÍ         NO
   │           │
Persiste    useOptimistic
en Supabase  revierte
   │        automáticamente
   │
   ▼
Supabase Realtime
canal: project-tasks:{projectId}
   │
   ▼
¿Cambio propio?
(record.user_id === currentUserId)
    /         \
  SÍ           NO
   │             │
 Ignorar      Aplicar en
(ya está      pantalla de
optimista)    otros miembros
```

Nota: *"Si la Server Action falla (ej. sin conexión), el tablero revierte visualmente al estado anterior. El usuario no necesita recargar."*

---

## Estilo visual de los diagramas

**No usar** Mermaid, D3, ni ninguna librería externa.

**Implementar con CSS puro + divs:**

Cada nodo es un `<div class="flow-node">` con variantes de color:
```css
.flow-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--r-md);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.flow-node.ui       { background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.35); color: var(--blue-ice); }
.flow-node.api      { background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2);  color: var(--blue-glow); }
.flow-node.ai       { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); color: #a5b4fc; }
.flow-node.db       { background: rgba(148,163,184,0.08); border: 1px solid rgba(148,163,184,0.2); color: var(--silver-hi); }
.flow-node.success  { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2); color: #34d399; }
.flow-node.warning  { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2);  color: #fbbf24; }
```

Las flechas entre nodos se hacen con `<div class="flow-arrow">↓</div>` o `→` con color `var(--slate-600)`.

Las decisiones (bifurcaciones SÍ/NO) se hacen con un nodo rombo `◆` en color `var(--blue-vivid)` y dos ramas en grid de 2 columnas.

Cada diagrama tiene un **tooltip al hacer hover** en cada nodo que explica en lenguaje simple qué hace ese paso. Implementar con `title=""` o con un `<div class="tooltip">` absoluto que aparece en hover.

---

## Leyenda global

Al inicio de la sección "Cómo funciona", antes de los diagramas, mostrar una leyenda visual:

```
● UI / Usuario    ● API / Servidor    ● IA / LLM    ● Base de datos    ⚠ Requiere confirmación
```

Con los colores correspondientes de `.flow-node`.

---

## Interactividad requerida

1. **Click en cualquier nodo** → se resalta (borde más brillante, glow)  
2. **Click en nodo de IA** → muestra un mini panel lateral con el modelo exacto usado  
   - Groq `llama-3.3-70b-versatile` (tool calling)  
   - Fallback: Claude Haiku 4.5 si Groq no responde  
   - Voyage AI `voyage-3-lite` (embeddings 512 dims)  
   - Voyage AI `rerank-2-lite` (reranking top-20 → top-5)  
3. **Click en nodo DB** → muestra: "Supabase · RLS activo en todas las tablas · pgvector halfvec(512) · HNSW index"  
4. **Botón "Ver flujo animado"** en cada diagrama → activa una animación CSS que recorre los nodos en orden con un pulso de color azul, 1 nodo cada 600ms

---

## Restricciones importantes

- **Sin librerías externas** — cero imports nuevos, cero CDN. Todo CSS y JS inline.
- **Mantener el sticky nav** existente funcionando (no romper el z-index).
- **El canvas de circuitos** del fondo sigue corriendo en ambas pestañas.
- **Responsive**: en mobile los diagramas hacen scroll horizontal, no se rompen.
- **El tab "Guía de Construcción" debe quedar idéntico** — solo envolverlo en su `tab-content`.
- Usar las mismas fuentes: `Syne` para títulos, `Space Mono` para etiquetas de nodos, `DM Sans` para descripciones.
- Los colores de nodo deben coincidir exactamente con los de la leyenda del archivo (mismos `--blue-vivid`, `--blue-ice`, etc.)

---

## Orden de entrega

1. CSS nuevo para tabs + diagramas → agregar dentro del `<style>` existente en `<head>`
2. JS nuevo para tabs + animaciones → agregar dentro del `<script>` existente al final del `<body>`
3. HTML: envolver contenido existente en `<div id="tab-guide" class="tab-content">...</div>`
4. HTML: agregar `<div id="tab-diagram" class="tab-content">` con los 4 diagramas
5. HTML: insertar el `<div class="tab-bar">` justo después del `</header>` y antes de `<section class="experts-section">`
