const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
const MODEL = "nomic-embed-text"


async function embed(text: string): Promise<number[]> {
  const cleaned = text.trim().replace(/\s+/g, " ").slice(0, 8000)
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: cleaned }),
  })
  if (!response.ok) {
    throw new Error(`Ollama embed error: ${response.status}`)
  }
  const data = await response.json()
  return data.embedding
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embed(text)
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return embed(query)
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
