// Voice commands: Web Speech recognition (Chrome/Android) + a small command parser in en/hi/pa.
import { LOCALE, getLang } from './settings'

export type Command =
  | { cmd: 'navigate' | 'read' | 'home' | 'ahead' | 'sign' | 'bin' | 'findBin' | 'snap' | 'guide' | 'more'
      | 'repeat' | 'stop' | 'count' | 'change' | 'note' | 'obstaclesOn' | 'obstaclesOff' }
  | { cmd: 'paid'; amount: number }
  | { cmd: 'ask'; text: string }

const has = (s: string, words: string[]) => words.some((w) => s.includes(w))

export function parseCommand(raw: string, mode: 'navigate' | 'read' | null): Command {
  const s = raw.toLowerCase().trim()
  const num = s.match(/(\d[\d,]*)/)
  if (num && has(s, ['paid', 'gave', 'दिए', 'दिया', 'ਦਿੱਤੇ', 'ਦਿੱਤਾ'])) return { cmd: 'paid', amount: Number(num[1].replace(/,/g, '')) }
  if (has(s, ['stop', 'रुको', 'रुकें', 'बंद करो', 'ਰੁਕੋ'])) return { cmd: 'stop' }
  if (has(s, ['repeat', 'again', 'दोबारा', 'फिर से', 'ਦੁਬਾਰਾ'])) return { cmd: 'repeat' }
  if (has(s, ['home', 'go back', 'वापस', 'होम', 'ਵਾਪਸ', 'ਮੁੱਖ'])) return { cmd: 'home' }
  if (s === 'more' || has(s, ['tell me more', 'read more', 'और बताओ', 'ਹੋਰ ਦੱਸੋ']) || s === 'और' || s === 'ਹੋਰ') return { cmd: 'more' }
  if (has(s, ['find bin', 'find the bin', 'where is the bin', 'डिब्बा कहाँ', 'डिब्बा ढूँढ', 'ਡੱਬਾ ਕਿੱਥੇ', 'ਡੱਬਾ ਲੱਭ'])) return { cmd: 'findBin' }
  if (has(s, ['obstacle on', 'obstacles on', 'start obstacle'])) return { cmd: 'obstaclesOn' }
  if (has(s, ['obstacle off', 'obstacles off', 'stop obstacle'])) return { cmd: 'obstaclesOff' }
  if (has(s, ['fake', 'check note', 'is this note', 'नकली', 'असली', 'ਨਕਲੀ', 'ਅਸਲੀ'])) return { cmd: 'note' }
  if (has(s, ['check change', 'my change', 'change', 'छुट्टा', 'खुले', 'ਭਾਨ', 'ਖੁੱਲ੍ਹੇ'])) return { cmd: 'change' }
  if (has(s, ['count', 'money', 'cash', 'गिनो', 'गिनें', 'पैसे', 'ਗਿਣੋ', 'ਪੈਸੇ'])) return { cmd: 'count' }
  if (has(s, ['what bin', 'which bin', 'bin', 'waste', 'trash', 'garbage', 'कचरा', 'कूड़ा', 'डिब्बा', 'ਕੂੜਾ', 'ਡੱਬਾ'])) return { cmd: 'bin' }
  if (has(s, ['sign', 'board', 'साइन', 'बोर्ड', 'ਸਾਈਨ', 'ਬੋਰਡ'])) return { cmd: 'sign' }
  if (has(s, ['ahead', 'in front', 'describe', 'around me', 'what do you see', 'सामने', 'आगे', 'आसपास', 'ਸਾਹਮਣੇ', 'ਅੱਗੇ'])) return { cmd: 'ahead' }
  if (has(s, ['guide', 'गाइड', 'ਗਾਈਡ'])) return { cmd: 'guide' }
  if (mode === 'read' && has(s, ['read this', 'read bill', 'read it', 'scan', 'पढ़ो', 'पढ़ें', 'ਪੜ੍ਹੋ'])) return { cmd: 'snap' }
  if (has(s, ['navigate', 'नेविगेट', 'ਨੈਵੀਗੇਟ'])) return { cmd: 'navigate' }
  if (has(s, ['read', 'रीड', 'पढ़', 'ਰੀਡ', 'ਪੜ੍ਹ'])) return mode === 'read' ? { cmd: 'snap' } : { cmd: 'read' }
  return { cmd: 'ask', text: raw.trim() }
}

type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
type RecognitionCtor = new () => RecognitionLike

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}
export const canListen = () => typeof window !== 'undefined' && !!ctor()

// Starts one recognition. Returns a stop function. onText gets the final transcript.
export function listen(onText: (text: string) => void, onEnd: (heard: boolean) => void): () => void {
  const Ctor = ctor()
  if (!Ctor) { onEnd(false); return () => undefined }
  const r = new Ctor()
  r.lang = LOCALE[getLang()]
  r.continuous = false
  r.interimResults = false
  let heard = false
  r.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript ?? ''
    if (text) { heard = true; onText(text) }
  }
  r.onerror = () => undefined
  r.onend = () => onEnd(heard)
  try { r.start() } catch { onEnd(false) }
  return () => { try { r.stop() } catch { /* already stopped */ } }
}
