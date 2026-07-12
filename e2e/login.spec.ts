import { test, expect } from '@playwright/test'

// Run without the saved auth session. These tests cover the unauthenticated flow.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Pagina de login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('muestra el formulario con email y contrasena', async ({ page }) => {
    await expect(page.getByText('TaskFlow AI').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /contin.a donde lo dejaste/i })).toBeVisible()
    await expect(page.getByLabel(/correo electr.nico/i)).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /iniciar sesi.n/i })).toBeVisible()
  })

  test('muestra error con credenciales invalidas', async ({ page }) => {
    await page.getByLabel(/correo electr.nico/i).fill('noexiste@test.com')
    await page.locator('#password').fill('wrongpassword123')
    await page.getByRole('button', { name: /inicia/i }).click()

    await expect(page.getByRole('alert').filter({ hasText: /credenciales inv.lidas/i })).toBeVisible({ timeout: 10_000 })
  })

  test('muestra error de validacion cuando el email es invalido', async ({ page }) => {
    const emailInput = page.getByLabel(/correo electr.nico/i)

    await emailInput.fill('invalido-sin-arroba')
    await page.locator('#password').fill('password123')
    await page.getByRole('button', { name: /inicia/i }).click()

    const isNativeInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )
    expect(isNativeInvalid).toBe(true)
    await expect(page).toHaveURL(/\/login/)
  })

  test('muestra error de validacion cuando la contrasena es corta', async ({ page }) => {
    await page.getByLabel(/correo electr.nico/i).fill('test@test.com')
    await page.locator('#password').fill('1234567')
    await page.getByRole('button', { name: /inicia/i }).click()

    await expect(page.getByText(/m.nimo 8 caracteres/i)).toBeVisible({ timeout: 5_000 })
  })

  test('guard: /board redirige a /login si no hay sesion', async ({ page }) => {
    await page.goto('/board')
    await expect(page).toHaveURL(/\/login/)
  })

  test('muestra enlace a registro', async ({ page }) => {
    await expect(page.getByRole('link', { name: /crear cuenta/i })).toHaveAttribute('href', '/register')
  })
})
