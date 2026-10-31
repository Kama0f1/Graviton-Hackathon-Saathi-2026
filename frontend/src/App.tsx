// Saathi app shell (mobile-first): top bar + language, home with two big modes,
// and a bottom dock with the live caption, status, mic, repeat and stop.
import { useEffect, useRef, useState } from 'react'
import './App.css'
import NavigateMode from './modes/NavigateMode'
import ReadMode from './modes/ReadMode'
import { onCaption, onVoiceIssue, repeat, say, stop, type Caption } from './core/speech'
import { api, onBusy } from './core/api'
import { canVibrate, getLang, getVibrate, onLang, setLang, setVibrate, type Lang } from './core/settings'
import { canListen, listen, parseCommand, type Command } from './core/listen'
import { haptics } from './core/haptics'
import { tick } from './core/audio'
import { t } from './i18n/phrases'

type Mode = 'navigate' | 'read' | null
let greeted = false // say hello once (React dev mode mounts twice)
const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'हिं', name: 'हिन्दी' },
  { code: 'pa', label: 'ਪੰ', name: 'ਪੰਜਾਬੀ' },
]
const MODE_CMDS = new Set(['ahead', 'sign', 'bin', 'findBin', 'obstaclesOn', 'obstaclesOff'])
const READ_CMDS = new Set(['snap', 'guide', 'more', 'count', 'change', 'note', 'paid', 'ask'])

export default function App() {
  const [mode, setMode] = useState<Mode>(null)
  const [lang, setLangState] = useState<Lang>(getLang())
  const [caption, setCaption] = useState<Caption>({ text: '', priority: 'info', speaking: false })
  const [busy, setBusy] = useState(0)
  const [listening, setListening] = useState(false)
  const [command, setCommand] = useState<(Command & { id: number }) | null>(null)
  const [shared, setShared] = useState<Blob | null>(null)
  const [server, setServer] = useState<'checking' | 'up' | 'down'>('checking')
  const [voiceIssue, setVoiceIssue] = useState<Lang | null>(null)
  const [vibrate, setVibrateState] = useState(getVibrate())
  const stopListening = useRef<(() => void) | null>(null)
  const cmdId = useRef(0)

  useEffect(() => onCaption(setCaption), [])
  useEffect(() => onBusy(setBusy), [])
  useEffect(() => onLang(setLangState), [])
  useEffect(() => { if (!greeted) { greeted = true; say(t('ready'), 'info') } }, [])
  useEffect(() => onVoiceIssue(setVoiceIssue), [])

  // Is the backend reachable? Without it nothing but obstacle alerts works, so say so clearly.
  useEffect(() => {
    let alive = true
    let wasDown = false
    const check = async () => {
      const ok = await api.health()
      if (!alive) return
      setServer(ok ? 'up' : 'down')
      if (!ok && !wasDown) say(t('serverDown'), 'info')
      wasDown = !ok
    }
    void check()
    const id = setInterval(check, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // soft tick while waiting for the server
  useEffect(() => {
    if (!busy) return
    const id = setInterval(tick, 1200)
    return () => clearInterval(id)
  }, [busy])

  // a file shared from WhatsApp etc. (see public/sw.js) -> straight into Read mode
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('shared') || !('caches' in window)) return
    history.replaceState(null, '', '/')
    void caches.open('saathi-share').then(async (c) => {
      const res = await c.match('/shared-file')
      if (!res) return
      await c.delete('/shared-file')
      setShared(await res.blob())
      setMode('read')
    })
  }, [])

  const go = (m: Mode) => {
    setMode(m)
    if (m === 'navigate') { haptics.navigate(); say(t('navigate'), 'info') }
    else if (m === 'read') { haptics.read(); say(t('read'), 'info') }
    else say(t('home'), 'info')
  }

  const send = (c: Command) => setCommand({ ...c, id: ++cmdId.current } as Command & { id: number })

  const handle = (c: Command) => {
    switch (c.cmd) {
      case 'navigate': go('navigate'); return
      case 'read': go('read'); return
      case 'home': go(null); return
      case 'repeat': repeat(); return
      case 'stop': stop(); send(c); return
    }
    if (MODE_CMDS.has(c.cmd) && mode !== 'navigate') { setMode('navigate'); haptics.navigate() }
    else if (READ_CMDS.has(c.cmd) && mode !== 'read') { setMode('read'); haptics.read() }
    // give the mode a moment to mount (and its camera to start) before it gets the command
    setTimeout(() => send(c), mode ? 0 : 400)
  }

  const mic = () => {
    haptics.tap()
    if (listening) { stopListening.current?.(); return }
    if (!canListen()) { say(t('noVoiceInput'), 'answer'); return }
    stop()
    setListening(true)
    stopListening.current = listen(
      (text) => handle(parseCommand(text, mode)),
      (heard) => { setListening(false); stopListening.current = null; if (!heard) say(t('notUnderstood'), 'info') },
    )
  }

  const changeLang = (l: Lang) => { setLang(l); setVoiceIssue(null); say(t('languageSet', {}, l), 'info', l) }

  const toggleVibrate = () => {
    if (!canVibrate()) { say(t('vibrationUnsupported'), 'answer'); return }
    const on = !vibrate
    setVibrate(on)
    setVibrateState(on)
    if (on) haptics.test()
    say(on ? t('vibrationOn') : t('vibrationOff'), 'info')
  }

  const chip = listening ? { k: 'listening', icon: '🎙', text: t('listening') }
    : busy ? { k: 'thinking', icon: '⏳', text: t('thinking') }
    : caption.speaking ? { k: 'speaking', icon: '🔊', text: t('speaking') }
    : { k: 'ready', icon: '✓', text: t('readyChip') }

  return (
    <div className="app" lang={lang}>
      <header className="topbar">
        {mode ? (
          <button type="button" className="back" onClick={() => go(null)} aria-label={t('back')}>
            <span aria-hidden="true">←</span> {t('back')}
          </button>
        ) : (
          <div className="brand">
            <div className="brand-icon" aria-hidden="true">S</div>
            <div><h1>Saathi</h1><p>YOUR AI COMPANION</p></div>
          </div>
        )}
        {mode && <h2 className="mode-title">{mode === 'navigate' ? t('navTitle') : t('readTitle')}</h2>}
        <div className="langs" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.code} type="button" aria-label={l.name} aria-pressed={lang === l.code}
              className={lang === l.code ? 'on' : ''} onClick={() => changeLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </header>

      {server === 'down' && (
        <div className="banner" role="alert">
          <b>⚠ {t('serverDown')}</b>
          <span>{t('serverHelp')}</span>
        </div>
      )}
      {voiceIssue && voiceIssue === lang && server === 'up' && (
        <div className="banner info" role="status">
          <span>{t('voiceMissing', { lang: LANGS.find((x) => x.code === voiceIssue)?.name ?? voiceIssue })}</span>
        </div>
      )}

      <main className="content">
        {!mode && (
          <div className="home">
            <button type="button" className="mode-card navigate" onClick={() => go('navigate')}
              aria-label={`${t('navTitle')}. ${t('navSub')}`}>
              <span className="mode-icon" aria-hidden="true">➤</span>
              <span className="mode-num">01 · EXPLORE</span>
              <span className="mode-name">{t('navTitle')}</span>
              <span className="mode-sub">{t('navSub')}</span>
            </button>
            <button type="button" className="mode-card read" onClick={() => go('read')}
              aria-label={`${t('readTitle')}. ${t('readSub')}`}>
              <span className="mode-icon" aria-hidden="true">▤</span>
              <span className="mode-num">02 · UNDERSTAND</span>
              <span className="mode-name">{t('readTitle')}</span>
              <span className="mode-sub">{t('readSub')}</span>
            </button>
            <div className="settings">
              <button type="button" className={`setting ${vibrate && canVibrate() ? 'on' : ''}`} onClick={toggleVibrate}
                aria-pressed={vibrate && canVibrate()}>
                <span aria-hidden="true">📳</span> {t('vibration')}: {canVibrate() ? (vibrate ? t('on') : t('off')) : '—'}
              </button>
            </div>
            {!canVibrate() && <p className="hint">{t('vibrationUnsupported')}</p>}
            <p className="hint">{t('hint')}</p>
          </div>
        )}
        {mode === 'navigate' && <NavigateMode command={command} />}
        {mode === 'read' && <ReadMode command={command} shared={shared} />}
      </main>

      <footer className="dock">
        <div className={`caption ${caption.speaking && caption.priority === 'alert' ? 'alert' : ''}`} role="status" aria-live="polite">
          <span className={`chip chip-${chip.k}`}><span aria-hidden="true">{chip.icon}</span> {chip.text}</span>
          <p>{caption.text || t('hint')}</p>
        </div>
        <div className="controls">
          <button type="button" className="ctrl" onClick={() => { haptics.tap(); repeat() }} aria-label={t('repeat')}>
            <span aria-hidden="true">↻</span><small>{t('repeat')}</small>
          </button>
          <button type="button" className={`mic ${listening ? 'live' : ''}`} onClick={mic} aria-pressed={listening} aria-label={t('mic')}>
            <span aria-hidden="true">🎙</span>
          </button>
          <button type="button" className="ctrl" onClick={() => { haptics.tap(); stop(); send({ cmd: 'stop' }) }} aria-label={t('stop')}>
            <span aria-hidden="true">■</span><small>{t('stop')}</small>
          </button>
        </div>
      </footer>
    </div>
  )
}
