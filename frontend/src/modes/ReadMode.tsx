// Read mode: documents and bills (/read), follow-up questions (/read/ask),
// and money: count, check change, check note (/money). Photo, guided capture, or upload (incl. PDF).
import { useEffect, useRef, useState } from 'react'
import CameraView from '../components/CameraView'
import ResultCard from '../components/ResultCard'
import { useCamera } from '../core/camera'
import { api, ApiError, type MoneyMode, type ReadResult } from '../core/api'
import { say } from '../core/speech'
import { haptics } from '../core/haptics'
import { startGuidance } from '../core/guidance'
import { fromMoney, fromRead, fromSpeech, money, type ResultSrc, src } from '../core/result'
import type { Command } from '../core/listen'
import { frame } from './useFrame'
import { t } from '../i18n/phrases'

const MAX_UPLOAD = 4 * 1024 * 1024  // hosting limit is 4.5 MB per request

// Big phone photos are shrunk before upload (also faster on mobile data). PDFs can't be shrunk here.
async function fitUpload(file: Blob): Promise<Blob | null> {
  if (!file.type.startsWith('image/') || file.size <= 1.5 * 1024 * 1024) return file.size <= MAX_UPLOAD ? file : null
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.9))
    if (out && out.size <= MAX_UPLOAD) return out
  } catch { /* fall through */ }
  return file.size <= MAX_UPLOAD ? file : null
}

export default function ReadMode({ command, shared }: {
  command: (Command & { id: number }) | null
  shared: Blob | null
}) {
  const cam = useCamera()
  const [result, setResult] = useState<ResultSrc | null>(null)
  const [guiding, setGuiding] = useState(false)
  const [question, setQuestion] = useState('')
  const [hint, setHint] = useState<{ arrow: string; text: string; ready: boolean } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)   // the captured photo, shown while reading
  const [reading, setReading] = useState(false)
  const lastRead = useRef<ReadResult | null>(null)
  const paid = useRef<number | undefined>(undefined)
  const stopGuide = useRef<(() => void) | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { void cam.start(); return () => { stopGuide.current?.(); cam.stop() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => { try { await fn() } catch (e) { if (!(e instanceof ApiError)) console.error(e) } }

  const readFile = (input: Blob) => run(async () => {
    const file = await fitUpload(input)
    if (!file) { say(t('tooBig'), 'answer'); haptics.warning(); return }
    const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setPreview(url)
    setReading(true)
    setHint(null)
    try {
      const r = await api.read(file)
      lastRead.current = r
      const view = fromRead(r)
      setResult(src(() => fromRead(r)))
      say(r.speech, 'answer')
      if (view.tone === 'warning') haptics.warning(); else haptics.success()
    } finally {
      setReading(false)
      setPreview(null)
      if (url) URL.revokeObjectURL(url)
    }
  })

  useEffect(() => { if (shared) { say(t('sharedFile'), 'info'); void readFile(shared) } }, [shared]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quick photo: read the current frame straight away (for sighted helpers or a well-framed page)
  const snap = () => run(async () => {
    const img = await frame(cam, 1600, 0.9); if (!img) return
    await readFile(img)
  })
  // Scan: guided capture (talks you into framing, auto-captures, never gets stuck), then reads it
  const guide = () => {
    if (guiding) { stopGuide.current?.(); stopGuide.current = null; setGuiding(false); setHint(null); say(t('guideStop'), 'info'); return }
    setGuiding(true)
    void cam.start().then((ok) => {
      if (!ok) { setGuiding(false); say(cam.error || t('cameraOff'), 'answer'); return }
      stopGuide.current = startGuidance(
        cam.grab,
        (photo) => { setGuiding(false); stopGuide.current = null; void readFile(photo) },
        setHint,
      )
    })
  }
  const more = () => {
    const r = lastRead.current
    say(r?.speech_more || t('noMore'), 'answer')
  }
  const ask = (q: string) => run(async () => {
    if (!q.trim()) return
    const d = lastRead.current
    const context = d ? JSON.stringify({ doc_type: d.doc_type, text: d.full_text ?? d.speech_more, fields: d.key_fields }) : undefined
    const r = await api.ask(q.trim(), context)
    setResult(src(() => fromSpeech(t('lblAnswer'), r)))
    say(r.speech, 'answer')
    setQuestion('')
  })
  const moneyCheck = (mode: MoneyMode) => run(async () => {
    const img = await frame(cam, 1280, 0.88); if (!img) return
    // Send what the app knows (bill total, amount paid) so the server needs no memory between calls
    const b = lastRead.current?.bill
    const billTotal = b ? (b.printed_total ?? (b.items.length ? b.computed_total : null)) : null
    const extra: { paid?: number; bill_total?: number } = {}
    if (billTotal != null) extra.bill_total = billTotal
    if (mode === 'change' && paid.current != null) extra.paid = paid.current
    const r = await api.money(img, mode, extra)
    const view = fromMoney(r)
    setResult(src(() => fromMoney(r)))
    say(r.speech, r.suspicious.length ? 'alert' : 'answer')
    if (view.tone === 'warning') haptics.warning(); else if (view.tone === 'success') haptics.success()
    if (mode === 'count') paid.current = r.paid ?? undefined
  })

  useEffect(() => {
    if (!command) return
    switch (command.cmd) {
      case 'snap': if (!guiding) guide(); break   // "read this" by voice = guided scan (the user can't see the frame)
      case 'guide': if (!guiding) guide(); break
      case 'more': more(); break
      case 'count': void moneyCheck('count'); break
      case 'change': void moneyCheck('change'); break
      case 'note': void moneyCheck('check'); break
      case 'paid': paid.current = command.amount; say(t('paidSet', { n: money(command.amount) }), 'answer'); break
      case 'ask': void ask(command.text); break
      case 'stop': if (guiding) guide(); break
    }
  }, [command?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mode">
      <CameraView cam={cam} badge={guiding ? t('scan') : undefined} overlay={
        reading ? (
          <div className="scan-overlay reading" aria-hidden="true">
            {preview && <img src={preview} alt="" />}
            <div className="scan-msg"><span className="spinner" /> {t('reading')}</div>
          </div>
        ) : guiding && hint ? (
          <div className={`scan-overlay ${hint.ready ? 'ready' : ''}`} aria-hidden="true">
            <div className="scan-frame" />
            <div className="scan-msg"><b>{hint.arrow}</b> {hint.text}</div>
          </div>
        ) : null
      } />
      <ResultCard src={result} />
      <div className="actions">
        <button type="button" className={`btn primary full ${guiding ? 'on' : ''}`} aria-pressed={guiding} onClick={guide} disabled={reading}>
          {guiding ? t('stop') : t('scanDoc')}</button>
        <button type="button" className="btn" onClick={() => void snap()} disabled={reading || guiding}>{t('quickPhoto')}</button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>{t('upload')}</button>
      </div>
      <h3 className="group">{t('money')}</h3>
      <div className="actions three">
        <button type="button" className="btn" onClick={() => void moneyCheck('count')}>{t('count')}</button>
        <button type="button" className="btn" onClick={() => void moneyCheck('change')}>{t('change')}</button>
        <button type="button" className="btn" onClick={() => void moneyCheck('check')}>{t('note')}</button>
      </div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); void ask(question) }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('askPlaceholder')} aria-label={t('askPlaceholder')} enterKeyHint="send" />
        <button type="submit">{t('ask')}</button>
      </form>
      <button type="button" className="toggle wide" onClick={more}>{t('more2')}</button>
      <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = '' }} />
    </div>
  )
}
