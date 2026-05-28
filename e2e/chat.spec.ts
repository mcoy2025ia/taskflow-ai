import { test, expect } from '@playwright/test'

// storageState is provided by playwright.config.ts (chromium project)

test.describe('Chat — asistente RAG', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat')
    await expect(page).toHaveURL(/\/chat/)
  })

  // ── Estructura de la página ─────────────────────────────────────────────────

  test('muestra el header y la descripción del asistente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Asistente RAG' })).toBeVisible()
    await expect(page.getByText('Busca y analiza tus tareas con lenguaje natural')).toBeVisible()
  })

  test('muestra el mensaje de bienvenida del asistente', async ({ page }) => {
    await expect(page.getByText(/Soy TaskFlow AI/)).toBeVisible({ timeout: 5_000 })
  })

  test('muestra el campo de texto y el botón de envío', async ({ page }) => {
    await expect(page.getByPlaceholder('Pregunta sobre tus tareas...')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('el botón de envío está deshabilitado cuando el input está vacío', async ({ page }) => {
    const sendBtn = page.locator('button[type="submit"]')
    await expect(sendBtn).toBeDisabled()
  })

  test('el botón de micrófono está visible', async ({ page }) => {
    await expect(page.getByTitle('Dictar por voz')).toBeVisible()
  })

  // ── Interacción básica ──────────────────────────────────────────────────────

  test('el botón de envío se habilita al escribir texto', async ({ page }) => {
    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')
    const sendBtn = page.locator('button[type="submit"]')

    await input.fill('Hola')
    await expect(sendBtn).toBeEnabled()

    await input.clear()
    await expect(sendBtn).toBeDisabled()
  })

  test('el mensaje del usuario aparece en el chat al enviarlo', async ({ page }) => {
    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')
    const message = `Prueba e2e ${Date.now()}`

    await input.fill(message)
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText(message)).toBeVisible({ timeout: 5_000 })
  })

  test('el input queda vacío tras enviar el mensaje', async ({ page }) => {
    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')

    await input.fill('¿Cuántas tareas tengo?')
    await page.locator('button[type="submit"]').click()

    await expect(input).toHaveValue('')
  })

  // ── Respuesta del asistente ─────────────────────────────────────────────────

  test('el asistente responde con texto tras recibir un mensaje', async ({ page }) => {
    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')

    await input.fill('¿Cómo va el proyecto?')
    await page.locator('button[type="submit"]').click()

    // Assistant message bubble appears (beyond the welcome message — there are now 2+ bubbles)
    await expect(page.locator('[class*="bg-muted"]').nth(1)).toBeVisible({ timeout: 30_000 })
  })

  test('la URL incluye session_id después de que el asistente responde', async ({ page }) => {
    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')

    await input.fill('Hola')
    await page.locator('button[type="submit"]').click()

    // Wait for assistant response to complete (session is persisted after response)
    await expect(page.locator('[class*="bg-muted"]').nth(1)).toBeVisible({ timeout: 30_000 })
    // Wait a bit for the session save + URL update
    await page.waitForFunction(() => window.location.search.includes('session_id'), { timeout: 10_000 })
    await expect(page).toHaveURL(/session_id=/)
  })

  // ── Sesiones persistidas ────────────────────────────────────────────────────

  test('navegar a /chat sin session_id muestra una conversación nueva vacía', async ({ page }) => {
    // Explicitly go to /chat without any query param
    await page.goto('/chat')

    // Only the welcome message should be visible — no prior history loaded
    const bubbles = page.locator('[class*="bg-muted"]')
    await expect(bubbles).toHaveCount(1, { timeout: 5_000 })
  })
})
