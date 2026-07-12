import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  // Supabase free-tier puede pausarse por inactividad y tardar en "despertar".
  // Sin timeout, un getUser() colgado deja el middleware (y por lo tanto toda
  // navegación) esperando indefinidamente — el navegador termina mostrando
  // "This page couldn't load". Preferimos fallar rápido a login antes que colgar.
  const authResult = await Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null } }>(resolve =>
      setTimeout(() => resolve({ data: { user: null } }), 5000)
    ),
  ])
  const { data: { user } } = authResult
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register')
  const isPublicRoute = isAuthRoute || request.nextUrl.pathname.startsWith('/invite')
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/board', request.url))
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/embed).*)'],
}
