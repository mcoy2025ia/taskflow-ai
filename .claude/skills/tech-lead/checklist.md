# Checklist SOLID — TypeScript / Next.js App Router

Úsala item por item al revisar. Marca ✅ (cumple), ⚠️ (parcial) o ❌ (viola).

---

## S — Single Responsibility Principle

Un módulo/componente/función tiene **una sola razón para cambiar**.

### Componentes React
- [ ] El componente no mezcla lógica de negocio con rendering (ej.: cálculos de posición en JSX)
- [ ] El componente no fetcha datos Y los renderiza en el mismo cuerpo (usar Server Component padre o custom hook)
- [ ] Los handlers de eventos no exceden ~10 líneas; si crecen, extraer a función nombrada
- [ ] Un componente de lista no decide el layout de cada ítem (delegar a componente hijo)
- [ ] Los custom hooks solo orquestan un dominio (no `useTaskAndAuth` mezclados)

### Server Actions (`actions/*.ts`)
- [ ] Cada action hace **una operación de DB** — no combina insert + update en la misma función
- [ ] La validación Zod está separada de la consulta Supabase (puede ser helper privado)
- [ ] `triggerEmbedding` es fire-and-forget y está en su propia función, no inline

### Archivos de librería (`lib/`)
- [ ] `voyage.ts` / `chat.ts` / `rag.ts` exportan funciones con responsabilidad única
- [ ] `hmac.ts` solo firma/verifica — no hace fetch ni manipula headers de negocio

---

## O — Open/Closed Principle

**Abierto para extensión, cerrado para modificación.**

### Componentes React
- [ ] Las variantes visuales usan un mapa de configuración (`Record<Variant, Config>`) en vez de `if/else` o `switch`
- [ ] Añadir una nueva columna Kanban no requiere modificar `board.tsx` — solo actualizar la config
- [ ] Los colores/labels de estado/prioridad están en un mapa exportable, no hardcoded en JSX
- [ ] Los componentes de layout aceptan `children` / `slot` en vez de renderizar contenido concreto

### Lógica de negocio
- [ ] La función de cálculo de posición no tiene casos hardcoded por status
- [ ] El sistema RAG puede cambiar de proveedor de chat/embed sin tocar `rag.ts`
- [ ] `getChatProvider()` es extensible: añadir proveedor = añadir `case`, no cambiar lógica existente

---

## L — Liskov Substitution Principle

**Los subtipos deben poder sustituir al tipo base sin cambiar el comportamiento del programa.**

### TypeScript / Interfaces
- [ ] Si `ComponentA` y `ComponentB` implementan la misma interfaz Props, son intercambiables en el consumidor
- [ ] Un `ChatProvider` alternativo (Groq vs Ollama) cumple el mismo contrato: `.stream()` retorna `ReadableStream<Uint8Array>` en ambos
- [ ] Las extensiones de tipos Zod (`.extend()`, `.partial()`) no violan el contrato del schema base
- [ ] Un `MockSupabaseClient` para tests respeta exactamente las firmas de `SupabaseClient`

### React / Hooks
- [ ] Un hook custom que reemplaza a otro (ej.: `useOptimisticTasks` → `useServerTasks`) expone la misma API
- [ ] Los wrappers de componentes (`SortableTaskCard` sobre `TaskCard`) no cambian la semántica visible del hijo

---

## I — Interface Segregation Principle

**Los clientes no deben depender de interfaces que no usan.**

### Props de componentes
- [ ] No existen props opcionales que se pasan "por si acaso" y nunca se usan en el render
- [ ] Un componente de presentación no recibe callbacks de Server Action que no invoca
- [ ] `isOverlay?: boolean` en `TaskCard` es el único flag de estado externo — no crece a `isLoading | isDragging | isSelected | isEditing` en el mismo componente
- [ ] Los props de config (colores, labels) no se pasan capa a capa cuando podrían vivir en un contexto o constante

### TypeScript Interfaces
- [ ] Las interfaces no superan ~7 propiedades sin dividirse en interfaces más pequeñas y componibles
- [ ] `Task` en `app.types.ts` no mezcla campos de UI (e.g. `isSelected`) con campos de dominio
- [ ] Los tipos de validación Zod (`CreateTaskInput`) no se reutilizan como tipos de props — se derivan tipos específicos si son distintos

---

## D — Dependency Inversion Principle

**Los módulos de alto nivel no deben depender de módulos de bajo nivel. Ambos deben depender de abstracciones.**

### Server Actions
- [ ] Las actions reciben el cliente Supabase por parámetro (o factory inyectable) para facilitar tests
- [ ] `triggerEmbedding` usa `NEXT_PUBLIC_APP_URL` configurable, no una URL hardcoded
- [ ] Las actions no importan directamente `fetch` del runtime — usan una abstracción o env variable

### Componentes React
- [ ] Los componentes que disparan Server Actions las reciben como prop/callback o acceden via context — no las importan directamente si son testeables en aislamiento
- [ ] `ChatInterface` no instancia el `EventSource`/`ReadableStream` directamente si hay un hook que lo encapsula
- [ ] Los componentes de formulario (`CreateTaskDialog`) no hardcodean la action — aceptan `onSubmit: (data: CreateTaskInput) => Promise<void>` y la acción concreta se pasa desde el padre

### Librerías AI
- [ ] `rag.ts` depende de la interfaz `generateQueryEmbedding: (q: string) => Promise<number[]>`, no del módulo `voyage.ts` concreto
- [ ] `getChatProvider()` retorna `ChatProvider` (interfaz), no `GroqProvider | OllamaProvider` (unión de concretos)

---

## Bonus: TypeScript Strictness (no SOLID, pero crítico en este stack)

- [ ] No hay `as unknown as T` ni dobles casts sin comentario explicativo
- [ ] No hay `any` explícito — usar `unknown` + type guard si el tipo es genuinamente desconocido
- [ ] Los tipos de retorno de funciones públicas están explícitamente anotados
- [ ] Los errores de Supabase se desestructuran y tipan: `{ data, error }`, no `result.data!`
- [ ] `useOptimistic` usa un reducer tipado, no mutación directa del estado
