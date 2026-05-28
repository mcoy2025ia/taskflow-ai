'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(\d+)\]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

export function useChatTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  function speakText(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    stopSpeaking()

    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    utterance.lang = 'es-CO'
    utterance.rate = 1.1
    utterance.pitch = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => () => stopSpeaking(), [stopSpeaking])

  return { isSpeaking, speakText, stopSpeaking }
}
