export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

export interface ChatProvider {
  stream(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>>
}

// DeepSeek: cloud, OpenAI-compatible, ideal para producción
class DeepSeekProvider implements ChatProvider {
  private readonly baseUrl = 'https://api.deepseek.com/v1'
  private readonly model = 'deepseek-chat'

  async stream(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: 0.3, // Bajo: respuestas más deterministas para gestión de tareas
        max_tokens: 1024,
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek error: ${response.status}`)
    }

    return response.body
  }
}

// Groq: cloud, ultra-rápido, alternativa a DeepSeek
class GroqProvider implements ChatProvider {
  private readonly baseUrl = 'https://api.groq.com/openai/v1'
  private readonly model = 'llama-3.3-70b-versatile'

  async stream(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: 0.3, // Bajo: respuestas más deterministas para gestión de tareas
        max_tokens: 1024,
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Groq error: ${response.status}`)
    }

    return response.body
  }
}

// Ollama: local, privado, sin costo por token
class OllamaProvider implements ChatProvider {
  private readonly baseUrl: string
  private readonly model: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    this.model = process.env.OLLAMA_MODEL ?? 'llama3.2'
  }

  async stream(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        options: {
          temperature: 0.3,
          num_predict: 1024,
        },
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Ollama error: ${response.status}. ¿Está corriendo 'ollama serve'?`)
    }

    return response.body
  }
}

// Factory: seleccionar proveedor en runtime
export function getChatProvider(): ChatProvider {
  const provider = process.env.CHAT_PROVIDER ?? 'deepseek'

  switch (provider) {
    case 'ollama':   return new OllamaProvider()
    case 'groq':     return new GroqProvider()
    case 'deepseek': return new DeepSeekProvider()
    default:
      console.warn(`[chat] Proveedor desconocido "${provider}", usando DeepSeek`)
      return new DeepSeekProvider()
  }
}