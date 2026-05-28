import { test, expect } from '@playwright/test'

// storageState is provided by playwright.config.ts (chromium project)

test.describe('Analytics — dashboard de analítica', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics')
    await expect(page).toHaveURL(/\/analytics/)

    // Wait for data to load — the loading spinner disappears and the heading appears
    await expect(
      page.getByRole('heading', { name: 'Analítica del Proyecto' })
    ).toBeVisible({ timeout: 15_000 })
  })

  // ── Estructura de la página ─────────────────────────────────────────────────

  test('muestra el encabezado del proyecto con fecha de entrega', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Analítica del Proyecto' })).toBeVisible()
    // Subtitle contains project name or fallback + delivery date info
    await expect(page.getByText(/días restantes/i)).toBeVisible()
  })

  test('muestra las cuatro tarjetas KPI', async ({ page }) => {
    await expect(page.getByText('Completadas')).toBeVisible()
    await expect(page.getByText('En Progreso')).toBeVisible()
    await expect(page.getByText('Por Hacer')).toBeVisible()
    await expect(page.getByText('Días Restantes')).toBeVisible()
  })

  test('muestra la sección de análisis de velocidad', async ({ page }) => {
    await expect(page.getByText('Análisis de Velocidad')).toBeVisible()
    await expect(page.getByText('Velocidad actual')).toBeVisible()
    await expect(page.getByText('Velocidad requerida')).toBeVisible()
    await expect(page.getByText('Tareas pendientes')).toBeVisible()
  })

  test('muestra el burndown chart', async ({ page }) => {
    await expect(page.getByText('Burndown Chart')).toBeVisible()
    // Legend items
    await expect(page.getByText('Real')).toBeVisible()
    await expect(page.getByText('Ideal')).toBeVisible()
  })

  test('muestra la sección de progreso por fase del pipeline', async ({ page }) => {
    await expect(page.getByText('Progreso por Fase del Pipeline')).toBeVisible()
  })

  test('muestra la sección de tareas por prioridad', async ({ page }) => {
    await expect(page.getByText('Tareas Pendientes por Prioridad')).toBeVisible()
    await expect(page.getByText('Alta')).toBeVisible()
    await expect(page.getByText('Media')).toBeVisible()
    await expect(page.getByText('Baja')).toBeVisible()
  })

  // ── Exportación PDF ─────────────────────────────────────────────────────────

  test('el botón "Exportar PDF" está visible y habilitado', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: 'Exportar PDF' })
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toBeEnabled()
  })

  test('al pulsar "Exportar PDF" el botón muestra estado de carga', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: 'Exportar PDF' })
    await exportBtn.click()

    // Button transitions to loading state ("Generando…")
    await expect(page.getByText('Generando…')).toBeVisible({ timeout: 3_000 })
    // And is disabled while loading
    await expect(exportBtn).toBeDisabled()
  })

  test('el botón "Exportar PDF" vuelve a habilitarse tras completar la exportación', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: 'Exportar PDF' })
    await exportBtn.click()

    // Wait for "Generando…" to appear then disappear (report + PDF generation)
    await expect(page.getByText('Generando…')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
  })

  // ── Navegación y guards ─────────────────────────────────────────────────────

  test('guard: /analytics redirige a /login si no hay sesión', async ({ page, context }) => {
    // Clear storage to simulate unauthenticated state
    await context.clearCookies()
    await page.goto('/analytics')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
