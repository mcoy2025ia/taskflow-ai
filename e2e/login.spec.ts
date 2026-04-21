import { test, expect } from '@playwright/test'

// Run WITHOUT the saved auth session — these tests cover the unauthenticated flow
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Página de login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('muestra el formulario con email y contraseña', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'TaskFlow AI' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Contraseña')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
  })

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.getByLabel('Email').fill('noexiste@test.com')
    await page.getByLabel('Contraseña').fill('wrongpassword123')
    await page.getByRole('button', { name: /Inicia/i }).click()

    // Filter by text to avoid matching Next.js route announcer (which also has role=alert)
    await expect(
      page.getByRole('alert').filter({ hasText: 'Credenciales inválidas' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('muestra error de validación cuando el email es inválido', async ({ page }) => {
    const emailInput = page.getByLabel('Email')

    await emailInput.fill('invalido-sin-arroba')
    await page.getByLabel('Contraseña').fill('password123')
    await page.getByRole('button', { name: /Inicia/i }).click()

    // The browser's native <input type="email"> blocks submission when '@' is missing
    // and shows its own constraint tooltip — React's handleSubmit never fires.
    // Assert the input is in an invalid constraint-validation state.
    const isNativeInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )
    expect(isNativeInvalid).toBe(true)

    // No navigation occurred — auth was blocked
    await expect(page).toHaveURL(/\/login/)
  })

  test('muestra error de validación cuando la contraseña es corta', async ({ page }) => {
    await page.getByLabel('Email').fill('test@test.com')
    await page.getByLabel('Contraseña').fill('1234567') // 7 chars — below min(8)
    await page.getByRole('button', { name: /Inicia/i }).click()

    await expect(page.getByText('Mínimo 8 caracteres')).toBeVisible({ timeout: 5_000 })
  })

  test('redirige a /board con credenciales correctas', async ({ page }) => {
    await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL ?? process.env.E2E_EMAIL ?? '')
    await page.getByLabel('Contraseña').fill(process.env.TEST_USER_PASSWORD ?? process.env.E2E_PASSWORD ?? '')
    await page.getByRole('button', { name: /Inicia/i }).click()

    await expect(page).toHaveURL(/\/board/, { timeout: 15_000 })
  })

  test('guard: /board redirige a /login si no hay sesión', async ({ page }) => {
    await page.goto('/board')
    await expect(page).toHaveURL(/\/login/)
  })

  test('muestra enlace a registro', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'Regístrate gratis' })
    ).toHaveAttribute('href', '/register')
  })
})
