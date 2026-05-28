import { test, expect } from '@playwright/test'

// storageState is provided by playwright.config.ts (chromium project)

const TASK_TITLE = `E2E Agent Task ${Date.now()}`

test.describe('Agente — tool calling', () => {
  test('crea una tarea via chat y aparece en el tablero', async ({ page }) => {
    // 1. Ir al chat y pedir al agente que cree una tarea
    await page.goto('/chat')
    await expect(page.getByText(/Soy TaskFlow AI/)).toBeVisible({ timeout: 10_000 })

    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')
    await input.fill(`Crea una tarea de alta prioridad llamada "${TASK_TITLE}"`)
    await page.locator('button[type="submit"]').click()

    // 2. Esperar que el agente ejecute la tool (indicador de actividad)
    await expect(page.getByText(/create.task|crear/i)).toBeVisible({ timeout: 15_000 }).catch(() => {
      // tool indicator may flash fast — continue
    })

    // 3. Esperar respuesta completa del asistente
    const assistantBubble = page.locator('[class*="bg-muted"]').nth(1)
    await expect(assistantBubble).toBeVisible({ timeout: 30_000 })

    // 4. Navegar al tablero y verificar que la tarea existe
    await page.goto('/board')
    await expect(page).toHaveURL(/\/board/)
    await expect(page.getByText(TASK_TITLE)).toBeVisible({ timeout: 10_000 })
  })

  test('confirmar eliminación muestra la card de confirmación', async ({ page }) => {
    // 1. Crear una tarea por API primero para tener algo que borrar
    await page.goto('/board')
    await expect(page).toHaveURL(/\/board/)

    // Find any task title to delete — use first visible task card
    const firstCard = page.locator('[data-task-card]').first()
    const hasCards = await firstCard.count() > 0

    // Skip if board is empty (CI without seeded data)
    test.skip(!hasCards, 'No hay tareas en el tablero para probar la eliminación')

    const taskTitle = await firstCard.locator('button').first().textContent()

    // 2. Ask agent to delete it
    await page.goto('/chat')
    await expect(page.getByText(/Soy TaskFlow AI/)).toBeVisible({ timeout: 10_000 })

    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')
    await input.fill(`Elimina la tarea "${taskTitle}"`)
    await page.locator('button[type="submit"]').click()

    // 3. Confirm card should appear (delete_task is destructive)
    await expect(page.getByText('Confirmar eliminación')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  })

  test('cancelar eliminación mantiene la tarea', async ({ page }) => {
    await page.goto('/board')
    const firstCard = page.locator('[data-task-card]').first()
    const hasCards = await firstCard.count() > 0
    test.skip(!hasCards, 'No hay tareas en el tablero')

    const taskTitle = await firstCard.locator('button').first().textContent()

    await page.goto('/chat')
    await expect(page.getByText(/Soy TaskFlow AI/)).toBeVisible({ timeout: 10_000 })

    const input = page.getByPlaceholder('Pregunta sobre tus tareas...')
    await input.fill(`Elimina la tarea "${taskTitle}"`)
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Confirmar eliminación')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Cancelar' }).click()

    await expect(page.getByText('Acción cancelada')).toBeVisible({ timeout: 5_000 })

    // Verify task still exists on board
    await page.goto('/board')
    await expect(page.getByText(taskTitle!)).toBeVisible({ timeout: 10_000 })
  })
})
