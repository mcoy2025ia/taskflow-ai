import { test as setup } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Path where the authenticated browser state is stored.
const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('autenticar usuario de prueba', async ({ page }) => {
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const email = process.env.TEST_USER_EMAIL || process.env.E2E_EMAIL || ''
  const password = process.env.TEST_USER_PASSWORD || process.env.E2E_PASSWORD || ''

  if (!email || !password) {
    throw new Error('Faltan TEST_USER_EMAIL o TEST_USER_PASSWORD en el archivo .env.local')
  }

  console.log('Iniciando proceso de autenticacion...')
  console.log(`Intentando login con: ${email}`)

  await page.goto('/login')

  await page.getByLabel(/correo electr.nico/i).fill(email)
  await page.locator('#password').fill(password)

  console.log('Haciendo clic en el boton de login...')

  const loginButton = page.getByRole('button', { name: /Inicia/i })
  await loginButton.click()

  console.log('Esperando redireccion al board...')

  try {
    await page.waitForURL('**/board', { timeout: 15000 })

    console.log('Login exitoso. Redirigido al board.')

    await page.context().storageState({ path: AUTH_FILE })
    console.log('Sesion guardada correctamente.')
  } catch {
    console.log('Error: El login no redirigio al board.')
    console.log('URL actual tras el fallo:', page.url())

    const errorText = await page
      .locator('[role="alert"], text=/credenciales|invalidas|invalid|error/i')
      .first()
      .textContent()
      .catch(() => 'No hay mensaje de error visible en pantalla')
    console.log('Mensaje detectado en la UI:', errorText?.trim() ?? 'Sin mensaje de error')

    throw new Error(
      `Fallo en la autenticacion. Revisa que el usuario ${email} sea correcto y tenga la confirmacion de email desactivada en Supabase.`
    )
  }
})
