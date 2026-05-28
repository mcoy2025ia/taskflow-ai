'use client'

import { useState, useRef, useEffect } from 'react'

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionResultEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onSubmit: (text: string) => void
}

export function useVoiceInput({ onTranscript, onSubmit }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Stable ref so the recognition onend callback always uses the latest onSubmit
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])

  const pendingTranscriptRef = useRef<string | null>(null)

  function startVoiceInput() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const API = w.SpeechRecognition || w.webkitSpeechRecognition

    if (!API) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new API()
    recognition.lang = 'es-CO'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0][0].transcript
      setVoiceMode(true)
      onTranscript(transcript)
      pendingTranscriptRef.current = transcript
    }

    recognition.onerror = () => {
      setIsListening(false)
      setVoiceMode(false)
      pendingTranscriptRef.current = null
    }

    recognition.onend = () => {
      setIsListening(false)
      const transcript = pendingTranscriptRef.current
      pendingTranscriptRef.current = null
      if (transcript) {
        setTimeout(() => onSubmitRef.current(transcript), 100)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return { isListening, voiceMode, setVoiceMode, startVoiceInput }
}
