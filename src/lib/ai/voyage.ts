const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_BASE_URL = "https://api.voyageai.com/v1"
const EMBED_MODEL = "voyage-3-small"

if (!VOYAGE_API_KEY) {
  throw new Error("VOYAGE_API_KEY no está configurada en variables de entorno")
}

async function embed(text: string, inputType: "document" | "query" = "document"): Promise<number[]> {
  const cleaned = text.trim().replace(/\s+/g, " ").slice(0, 8000)

  const response = await fetch(`${VOYAGE_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: cleaned,
      input_type: inputType,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Voyage] Error ${response.status}:`, error)
    throw new Error(`Voyage embed error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error("Respuesta inesperada de Voyage API")
  }

  return data.data[0].embedding
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embed(text, "document")
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return embed(query, "query")
}

export function buildTaskContent(title: string, description?: string | null): string {
  return description ? `${title}\n\n${description}` : title
}

export async function hashContent(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const buffer = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
}