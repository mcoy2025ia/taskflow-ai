# Contributing to TaskFlow AI

## Branching strategy

`main` es la rama de producción. Nunca hacer commits directos.

| Prefijo | Cuándo usarlo |
|---------|--------------|
| `feat/` | Nueva funcionalidad |
| `fix/` | Corrección de bug |
| `chore/` | Tareas de mantenimiento (deps, config, CI) |
| `docs/` | Solo documentación |
| `refactor/` | Refactor sin cambio de comportamiento |

Ejemplo: `feat/task-filters`, `fix/sse-stream-close`, `chore/upgrade-next-16`.

## Flujo de trabajo

```
main
 └── feat/mi-feature   ← rama de trabajo
      └── (commits)
      └── PR → main    ← requiere CI verde
```

1. Crear rama desde `main` actualizado:
   ```bash
   git checkout main && git pull
   git checkout -b feat/mi-feature
   ```

2. Desarrollar con commits atómicos y descriptivos:
   ```
   feat: add task priority filter to kanban board
   fix: prevent SSE stream from hanging on Ollama timeout
   chore: bump @supabase/ssr to 0.10.2
   ```

3. Antes de abrir PR, asegurar que pasan todas las validaciones locales:
   ```bash
   npm run lint          # ESLint sin warnings
   npx tsc --noEmit      # sin errores de tipos
   npm test              # Vitest
   npm run build         # build exitoso
   ```

4. Abrir Pull Request hacia `main`. El pipeline CI corre automáticamente.
   Solo se puede hacer merge cuando todos los jobs están en verde.

5. Merge con **Squash and merge** para mantener historial limpio en `main`.
   El deploy a Vercel ocurre automáticamente tras el merge.

## Tests

### Unitarios (Vitest)

```bash
npm test                                              # una pasada
npm run test:watch                                    # modo watch
npm run test:coverage                                 # con reporte de cobertura
npx vitest run src/actions/__tests__/tasks.test.ts    # archivo específico
```

Los tests de Server Actions usan el patrón `makeChain()` definido en `tasks.test.ts` para mockear el query builder de Supabase. Replicar ese patrón para nuevas acciones.

### E2E (Playwright)

Los E2E requieren credenciales reales en `.env.local`:

```env
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=supersecret
```

```bash
npm run test:e2e          # todos los tests (arranca dev server)
npm run test:e2e:ui       # modo visual interactivo
npx playwright test e2e/dashboard.spec.ts   # archivo específico
```

El proyecto `setup` en `playwright.config.ts` ejecuta `e2e/auth.setup.ts` primero,
guarda el estado de sesión en `e2e/.auth/user.json`, y los tests de Chromium lo reutilizan.
El directorio `e2e/.auth/` está en `.gitignore`.

## Seguridad — reglas que no se rompen

- `SUPABASE_SERVICE_ROLE_KEY` jamás en código cliente.
- Toda Server Action valida con Zod `.safeParse()` antes de cualquier query.
- Queries de Supabase siempre incluyen `.eq('user_id', user.id)` además del RLS.
- No exponer secrets en logs ni en mensajes de error del cliente.

## CI/CD

El pipeline en `.github/workflows/ci-cd.yml` corre en cada push:

| Job | Trigger | Pasos |
|-----|---------|-------|
| `ci` | todo push / PR a main | lint → type-check → tests → build |
| `deploy-production` | push a `main` (CI verde) | vercel pull → vercel build → vercel deploy |

Los secrets necesarios en GitHub Actions (Settings → Secrets → Actions):

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY
EMBED_INTERNAL_SECRET
TEST_USER_EMAIL
TEST_USER_PASSWORD
```
