import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Definimos la ruta donde se guardará la sesión
const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('autenticar usuario de prueba', async ({ page }) => {
  // 1. Crear el directorio de autenticación si no existe
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // 2. Obtener credenciales de las variables de entorno
  const email = process.env.TEST_USER_EMAIL || process.env.E2E_EMAIL || ''
  const password = process.env.TEST_USER_PASSWORD || process.env.E2E_PASSWORD || ''

  if (!email || !password) {
    throw new Error('Faltan TEST_USER_EMAIL o TEST_USER_PASSWORD en el archivo .env.local')
  }

  console.log('🚀 Iniciando proceso de autenticación...')
  console.log(`📧 Intentando login con: ${email}`)

  // 3. Navegar a la página de login
  await page.goto('/login')
  
  // 4. Llenar el formulario usando los labels exactos de tu UI
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  
  console.log('🖱️ Haciendo clic en el botón de login...')
  
  /**
   * Usamos una expresión regular /Inicia/i para que el test no falle 
   * cuando el botón cambie de "Iniciar sesión" a "Iniciando sesión..."
   */
  const loginButton = page.getByRole('button', { name: /Inicia/i })
  await loginButton.click()

  console.log('⏳ Esperando redirección al board...')

  try {
    // 5. Esperar a que la URL cambie a /board (éxito)
    // Usamos un timeout largo (15s) por si Supabase o Next.js están lentos
    await page.waitForURL('**/board', { timeout: 15000 })
    
    console.log('✅ ¡Login exitoso! Redirigido al board.')

    // 6. Guardar el estado de las cookies y almacenamiento local
    await page.context().storageState({ path: AUTH_FILE })
    console.log('💾 Sesión guardada correctamente.')

  } catch (error) {
    // 7. Si falla, imprimimos información útil para depurar
    console.log('❌ Error: El login no redirigió al board.')
    console.log('📍 URL actual tras el fallo:', page.url())
    
    // Intentamos capturar el mensaje de error que muestra tu app (Toast o Alert)
    const errorText = await page.getByRole('alert').textContent().catch(() => 'No hay mensaje de error visible en pantalla')
    console.log('📝 Mensaje detectado en la UI:', errorText?.trim() ?? 'Sin mensaje de error')
    
    throw new Error(`Fallo en la autenticación. Revisa que el usuario ${email} sea correcto y tenga la confirmación de email desactivada en Supabase.`)
  }
})