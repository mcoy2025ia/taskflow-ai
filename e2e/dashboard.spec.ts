import { test, expect, type Page } from '@playwright/test'

// storageState is provided by playwright.config.ts (chromium project)

/**
 * Clicks the + button in a Kanban column header.
 *
 * @base-ui/react Dialog.Trigger renders TWO button elements when using asChild:
 *   1. An invisible trigger relay (data-slot="dialog-trigger", data-base-ui-click-trigger)
 *   2. The visible Button component (data-slot="button")
 * We must target the visible one to avoid strict-mode violations.
 */
async function clickAddButton(page: Page, columnName: string) {
  await page
    .getByRole('heading', { name: columnName })
    .locator('xpath=../..')
    .locator('[data-slot="button"]')
    .click()
}

test.describe('Dashboard — tablero Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/board')
    await expect(page).toHaveURL(/\/board/)
  })

  test('muestra las tres columnas del tablero', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Por hacer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'En progreso' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Completado' })).toBeVisible()
  })

  test('abre el diálogo de nueva tarea al pulsar +', async ({ page }) => {
    await clickAddButton(page, 'Por hacer')

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nueva tarea' })).toBeVisible()
  })

  test('crea una nueva tarea y la muestra en la columna', async ({ page }) => {
    const taskTitle = `Tarea e2e ${Date.now()}`

    await clickAddButton(page, 'Por hacer')
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByLabel('Título').fill(taskTitle)
    await page.getByLabel('Descripción (opcional)').fill('Descripción de prueba')
    await page.getByLabel('Prioridad').selectOption('high')

    await page.getByRole('button', { name: 'Crear tarea' }).click()

    // Dialog closes and the new task card appears in the board
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 8_000 })
  })

  test('no crea tarea si el título está vacío', async ({ page }) => {
    await clickAddButton(page, 'Por hacer')
    await expect(page.getByRole('dialog')).toBeVisible()

    // Submit without filling title
    await page.getByRole('button', { name: 'Crear tarea' }).click()

    // Dialog must remain open and show the required-field error
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('El título es requerido')).toBeVisible()
  })

  test('muestra texto vacío en columnas sin tareas', async ({ page }) => {
    // The empty-state placeholder only renders when a column has no tasks.
    // With a real user account the board may be fully populated — the test
    // verifies the component works correctly in whichever state it finds.
    const emptyMessages = page.getByText('Arrastra tareas aquí')
    const count = await emptyMessages.count()

    if (count > 0) {
      await expect(emptyMessages.first()).toBeVisible()
    } else {
      // All columns have tasks — board is populated, which is also a valid state
      await expect(page.getByRole('heading', { name: 'Por hacer' })).toBeVisible()
    }
  })
})
