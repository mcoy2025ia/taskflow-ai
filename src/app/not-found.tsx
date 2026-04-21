// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-semibold">404 - No encontrado</h2>
      <p className="text-muted-foreground">La página que buscas no existe.</p>
    </div>
  )
}