// Voice commands: Web Speech recognition (Chrome/Android) + a small command parser in en/hi/pa.
// Accuracy tricks: the recogniser gives up to 5 guesses and we take the first one that is a real command;
// English words must match as whole words ("bin" does not fire on "cabinet"); longer sentences in Read mode
// are treated as questions about the document, so "can I change the date?" is a question, not "check change".
import { LOCALE, getLang } from './settings'

export type Command =
  | { cmd: 'navigate' | 'read' | 'home' | 'ahead' | 'sign' | 'bin' | 'findBin' | 'snap' | 'guide' | 'more'
      | 'repeat' | 'stop' | 'count' | 'change' | 'note' | 'obstaclesOn' | 'obstaclesOff' | 'whereAmI' | 'directions' }
  | { cmd: 'paid'; amount: number }
  | { cmd: 'route'; place: string }
  | { cmd: 'ask'; text: string }

type Mode = 'navigate' | 'read' | null

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// whole-word match for Latin script; Devanagari/Gurmukhi words are matched as written (no \b support there)
const has = (s: string, words: string[]) =>
  words.some((w) => (/^[\x20-\x7e]+$/.test(w) ? new RegExp(`(^|[^a-z])${esc(w)}($|[^a-z])`).test(s) : s.includes(w)))
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

const NUM_WORDS: Record<string, number> = {
  ten: 10, twenty: 20, fifty: 50, hundred: 100, 'one hundred': 100, 'two hundred': 200, 'five hundred': 500,
  thousand: 1000, 'one thousand': 1000, 'two thousand': 2000,
  'सौ': 100, 'दो सौ': 200, 'पांच सौ': 500, 'पाँच सौ': 500, 'हज़ार': 1000, 'हजार': 1000, 'दो हज़ार': 2000, 'दो हजार': 2000,
  'ਸੌ': 100, 'ਦੋ ਸੌ': 200, 'ਪੰਜ ਸੌ': 500, 'ਹਜ਼ਾਰ': 1000, 'ਦੋ ਹਜ਼ਾਰ': 2000,
}
function amount(s: string): number | null {
  const d = s.match(/(\d[\d,]*(?:\.\d+)?)/)
  if (d) return Number(d[1].replace(/,/g, ''))
  let best: [string, number] | null = null
  for (const [w, n] of Object.entries(NUM_WORDS)) if (s.includes(w) && (!best || w.length > best[0].length)) best = [w, n]
  return best ? best[1] : null
}

// "take me to the bus stand" / "बस स्टैंड ले चलो" / "ਬੱਸ ਅੱਡੇ ਲੈ ਚੱਲੋ" -> the place
const ROUTE_BEFORE = /(?:take me to|navigate to|directions to|direction to|guide me to|how do i get to|how to go to|how do i go to|i want to go to|go to|walk to|route to|where is the nearest|where is nearest|find the nearest|nearest)\s+(.+)/
const ROUTE_AFTER = /^(.+?)\s*(?:ले चलो|ले चलें|लेकर चलो|कैसे जाऊं|कैसे जाऊँ|कैसे जाएं|जाना है|का रास्ता|तक ले चलो|ਲੈ ਚੱਲੋ|ਲੈ ਕੇ ਚੱਲੋ|ਕਿਵੇਂ ਜਾਵਾਂ|ਜਾਣਾ ਹੈ|ਦਾ ਰਸਤਾ)/
function routePlace(s: string): string | null {
  const m = s.match(ROUTE_BEFORE) ?? s.match(ROUTE_AFTER)
  if (!m) return null
  const place = m[1].replace(/^(the|a|nearest|मुझे|ਮੈਨੂੰ)\s+/, '').replace(/\s*(please|प्लीज़|ਕਿਰਪਾ ਕਰਕੇ)$/, '').trim()
  // "go to read mode" / "go back home" are app commands, not places
  if (place.length < 2 || /^(read|reading|navigate|navigation|home|back|read mode|navigate mode|the bin|bin|dustbin)( mode)?$/.test(place)) return null
  return place
}

const QUESTION = /^(what|when|who|how much|how many|which|why|is there|does|do i|can i|क्या|कब|कितना|कितने|कौन|किस|ਕੀ|ਕਦੋਂ|ਕਿੰਨਾ|ਕਿੰਨੇ|ਕੌਣ)/

/** Parse one transcript. Returns null when it is not a known command (caller may treat it as a question). */
export function matchCommand(raw: string, mode: Mode, allowWeak = true): Command | null {
  const s = raw.toLowerCase().replace(/[?!.,।]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return null
  const n = words(s)

  if (has(s, ['find bin', 'find the bin', 'where is the bin', 'nearest bin', 'डिब्बा कहाँ', 'डिब्बा ढूँढ', 'डिब्बा ढूंढ', 'ਡੱਬਾ ਕਿੱਥੇ', 'ਡੱਬਾ ਲੱਭ'])) return { cmd: 'findBin' }
  // directions next: "go to ..." contains words that would otherwise look like other commands
  const place = routePlace(s)
  if (place) return { cmd: 'route', place }
  if (has(s, ['stop directions', 'stop navigation', 'cancel route', 'रास्ता बंद', 'ਰਸਤਾ ਬੰਦ'])) return { cmd: 'stop' }
  if (has(s, ['where am i', 'my location', 'मैं कहाँ हूँ', 'मैं कहां हूं', 'ਮੈਂ ਕਿੱਥੇ ਹਾਂ'])) return { cmd: 'whereAmI' }
  if (n <= 3 && has(s, ['directions', 'direction', 'route', 'रास्ता', 'ਰਸਤਾ'])) return { cmd: 'directions' }

  const amt = amount(s)
  if (amt != null && has(s, ['paid', 'gave', 'i paid', 'दिए', 'दिया', 'दिये', 'ਦਿੱਤੇ', 'ਦਿੱਤਾ'])) return { cmd: 'paid', amount: amt }
  if (has(s, ['stop', 'quiet', 'shut up', 'रुको', 'रुकें', 'बंद करो', 'चुप', 'ਰੁਕੋ', 'ਬੰਦ ਕਰੋ', 'ਚੁੱਪ'])) return { cmd: 'stop' }
  if (has(s, ['repeat', 'say again', 'again', 'दोबारा', 'फिर से', 'ਦੁਬਾਰਾ', 'ਫਿਰ ਤੋਂ'])) return { cmd: 'repeat' }
  if (has(s, ['home', 'go back', 'main menu', 'वापस', 'होम', 'ਵਾਪਸ', 'ਮੁੱਖ'])) return { cmd: 'home' }
  if (s === 'more' || s === 'next' || has(s, ['tell me more', 'read more', 'read all', 'और बताओ', 'पूरा पढ़ो', 'ਹੋਰ ਦੱਸੋ', 'ਪੂਰਾ ਪੜ੍ਹੋ']) || s === 'और' || s === 'ਹੋਰ') return { cmd: 'more' }
  if (has(s, ['obstacle on', 'obstacles on', 'start obstacle', 'रुकावट चालू', 'ਰੁਕਾਵਟ ਚਾਲੂ'])) return { cmd: 'obstaclesOn' }
  if (has(s, ['obstacle off', 'obstacles off', 'stop obstacle', 'रुकावट बंद', 'ਰੁਕਾਵਟ ਬੰਦ'])) return { cmd: 'obstaclesOff' }
  if (has(s, ['fake', 'real note', 'check note', 'check the note', 'is this note', 'नकली', 'असली', 'ਨਕਲੀ', 'ਅਸਲੀ'])) return { cmd: 'note' }

  // from here on, a long sentence in Read mode that does not START like a command is a question
  const longQuestion = mode === 'read' && n >= 5 && QUESTION.test(s)
  if (!longQuestion) {
    if (has(s, ['check change', 'check my change', 'my change', 'count change', 'change', 'छुट्टा', 'खुले', 'बाकी पैसे', 'ਭਾਨ', 'ਖੁੱਲ੍ਹੇ', 'ਬਾਕੀ ਪੈਸੇ'])) return { cmd: 'change' }
    if (has(s, ['count', 'count money', 'money', 'cash', 'गिनो', 'गिनें', 'पैसे गिन', 'पैसे', 'ਗਿਣੋ', 'ਪੈਸੇ'])) return { cmd: 'count' }
    if (has(s, ['what bin', 'which bin', 'bin', 'waste', 'trash', 'garbage', 'dustbin', 'कचरा', 'कूड़ा', 'डिब्बा', 'डस्टबिन', 'ਕੂੜਾ', 'ਡੱਬਾ'])) return { cmd: 'bin' }
    if (has(s, ['sign', 'board', 'signboard', 'साइन', 'बोर्ड', 'ਸਾਈਨ', 'ਬੋਰਡ'])) return { cmd: 'sign' }
    if (has(s, ['ahead', 'in front', 'describe', 'around me', 'what do you see', 'what is there', 'look', 'सामने', 'आगे', 'आसपास', 'क्या दिख', 'ਸਾਹਮਣੇ', 'ਅੱਗੇ', 'ਆਲੇ ਦੁਆਲੇ'])) return { cmd: 'ahead' }
  }
  if (has(s, ['guide', 'गाइड', 'ਗਾਈਡ'])) return { cmd: 'guide' }
  if (has(s, ['read this', 'read bill', 'read the bill', 'read it', 'scan', 'पढ़ो', 'पढ़ें', 'पढ़ दो', 'ਪੜ੍ਹੋ', 'ਪੜ੍ਹ ਦਿਓ'])) return mode === 'read' ? { cmd: 'snap' } : { cmd: 'read' }
  if (has(s, ['read mode', 'reading mode', 'रीड मोड', 'ਰੀਡ ਮੋਡ'])) return { cmd: 'read' }
  if (has(s, ['navigate', 'navigation', 'नेविगेट', 'ਨੈਵੀਗੇਟ'])) return { cmd: 'navigate' }
  // weak guess: a bare "read ..." - only used if no other recogniser guess is a clearer command
  if (allowWeak && n <= 3 && has(s, ['read', 'reading', 'रीड', 'पढ़', 'ਰੀਡ', 'ਪੜ੍ਹ'])) return mode === 'read' ? { cmd: 'snap' } : { cmd: 'read' }
  return null
}

/** Best command across the recogniser's guesses; otherwise the top guess as a question. */
export function parseAlternatives(alts: string[], mode: Mode): Command {
  for (const weak of [false, true]) {
    for (const a of alts) {
      const c = matchCommand(a, mode, weak)
      if (c) return c
    }
  }
  return { cmd: 'ask', text: (alts[0] ?? '').trim() }
}
export const parseCommand = (raw: string, mode: Mode): Command => parseAlternatives([raw], mode)

type Alt = { transcript: string; confidence?: number }
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<Alt>> }) => void) | null
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

// Starts one recognition. Returns a stop function. onText gets all guesses, best first.
export function listen(onText: (alternatives: string[]) => void, onEnd: (heard: boolean, error?: string) => void): () => void {
  const Ctor = ctor()
  if (!Ctor) { onEnd(false, 'unsupported'); return () => undefined }
  const r = new Ctor()
  r.lang = LOCALE[getLang()]
  r.continuous = false
  r.interimResults = false
  r.maxAlternatives = 5
  let heard = false
  let error: string | undefined
  r.onresult = (e) => {
    const res = e.results[0]
    const alts: string[] = []
    for (let i = 0; res && i < res.length; i++) if (res[i]?.transcript) alts.push(res[i].transcript)
    if (alts.length) { heard = true; onText(alts) }
  }
  r.onerror = (e) => { error = e.error }
  r.onend = () => onEnd(heard, error)
  try { r.start() } catch { onEnd(false, 'start') }
  return () => { try { r.stop() } catch { /* already stopped */ } }
}
