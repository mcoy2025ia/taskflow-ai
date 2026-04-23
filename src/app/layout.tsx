import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { cn } from "@/lib/utils"

const geist = Geist({ 
  subsets: ['latin'], 
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})
const geistMono = Geist_Mono({ 
  variable: '--font-mono', 
  subsets: ['latin'],
  display: 'swap',
  preload: false, // mono solo se usa en código, no en ruta crítica
})

export const metadata: Metadata = {
  title: {
    default: 'TaskFlow AI',
    // Each page can override just the prefix: "Mi tablero | TaskFlow AI"
    template: '%s | TaskFlow AI',
  },
  description:
    'Gestiona tus tareas con inteligencia artificial. Tablero Kanban con drag-and-drop y asistente RAG en lenguaje natural.',
  openGraph: {
    siteName: 'TaskFlow AI',
    type: 'website',
  },
}

// Next.js 13+: viewport must be a separate export, not inside metadata.
// Deliberately omitting userScalable:false and maximumScale — these break
// pinch-to-zoom on mobile and fail Lighthouse accessibility audits.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        {/* Script inline: aplicar tema ANTES del primer paint — evita flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme')
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                if (t === 'dark' || (!t && prefersDark)) {
                  document.documentElement.classList.add('dark')
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
