// Saathi app shell (mobile-first): top bar (repeat · title · language), the open tab, a caption strip with what is
// being said, and a floating bottom dock: Navigate · Read · Speak (mic) · Say (command list) · Settings.
import { useEffect, useRef, useState } from 'react'
import './App.css'
import NavigateMode from './modes/NavigateMode'
import ReadMode from './modes/ReadMode'
import SayTab from './modes/SayTab'
import SettingsTab from './modes/SettingsTab'
import Icon, { type IconName } from './components/Icon'
import { onCaption, onVoiceIssue, repeat, say, stop, type Caption } from './core/speech'
import { api, onBusy } from './core/api'
import { getLang, onLang, setLang, setObstacles, type Lang } from './core/settings'
import { canListen, listen, parseAlternatives, type Command } from './core/listen'
import { haptics } from './core/haptics'
import { beep, tick } from './core/audio'
import { t } from './i18n/phrases'

type Tab = 'navigate' | 'read' | 'say' | 'settings'
let greeted = false // say hello once (React dev mode mounts twice)
const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'हिं', name: 'हिन्दी' },
  { code: 'pa', label: 'ਪੰ', name: 'ਪੰਜਾਬੀ' },
]
const NAV_CMDS = new Set(['ahead', 'sign', 'bin', 'findBin', 'route', 'whereAmI', 'directions'])
const READ_CMDS = new Set(['snap', 'guide', 'more', 'count', 'change', 'note', 'paid', 'ask'])

export default function App() {
  const [tab, setTab] = useState<Tab>('navigate')
  const [lang, setLangState] = useState<Lang>(getLang())
  const [caption, setCaption] = useState<Caption>({ text: '', priority: 'info', speaking: false })
  const [busy, setBusy] = useState(0)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [command, setCommand] = useState<(Command & { id: number }) | null>(null)
  const [shared, setShared] = useState<Blob | null>(null)
  const [server, setServer] = useState<'checking' | 'up' | 'down'>('checking')
  const [voiceIssue, setVoiceIssue] = useState<Lang | null>(null)
  const stopListening = useRef<(() => void) | null>(null)
  const cmdId = useRef(0)
  const mode = tab === 'navigate' || tab === 'read' ? tab : null // what the voice parser should assume

  useEffect(() => onCaption(setCaption), [])
  useEffect(() => onBusy(setBusy), [])
  useEffect(() => onLang(setLangState), [])
  useEffect(() => { if (!greeted) { greeted = true; say(t('ready'), 'info') } }, [])
  useEffect(() => onVoiceIssue(setVoiceIssue), [])

  // Is the backend reachable? Without it nothing but obstacle alerts and directions works, so say so clearly.
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

  // soft tick while waiting for the server (a sound, not words)
  useEffect(() => {
    if (!busy) return
    const id = setInterval(tick, 1200)
    return () => clearInterval(id)
  }, [busy])

  // a file shared from WhatsApp etc. (see public/sw.js) -> straight into Read
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('shared') || !('caches' in window)) return
    history.replaceState(null, '', '/')
    void caches.open('saathi-share').then(async (c) => {
      const res = await c.match('/shared-file')
      if (!res) return
      await c.delete('/shared-file')
      setShared(await res.blob())
      setTab('read')
    })
  }, [])

  const go = (x: Tab) => {
    haptics.tap()
    setCommand(null) // a freshly opened tab must not re-run the last voice command
    setTab(x)
    window.scrollTo({ top: 0 })
    if (x === 'navigate') { haptics.navigate(); say(t('navigate'), 'info') }
    else if (x === 'read') { haptics.read(); say(t('read'), 'info') }
    else if (x === 'say') say(t('sayOpen'), 'info')
    else say(t('settingsOpen'), 'info')
  }

  const send = (c: Command) => setCommand({ ...c, id: ++cmdId.current } as Command & { id: number })

  const handle = (c: Command) => {
    switch (c.cmd) {
      case 'navigate': case 'home': go('navigate'); return
      case 'read': go('read'); return
      case 'repeat': repeat(); return
      case 'stop': stop(); send(c); return
      case 'obstaclesOn': setObstacles(true); say(t('obstaclesOn'), 'info'); return
      case 'obstaclesOff': setObstacles(false); say(t('obstaclesOff'), 'info'); return
    }
    if (c.cmd === 'ask' && mode !== 'read') { say(`${t('notUnderstood')} ${t('helpSay')}`, 'answer'); return }
    let target: Tab = tab
    if (NAV_CMDS.has(c.cmd) || (c.cmd === 'more' && tab === 'navigate')) target = 'navigate'
    else if (READ_CMDS.has(c.cmd)) target = 'read'
    if (target !== tab) { setCommand(null); setTab(target); window.scrollTo({ top: 0 }); if (target === 'navigate') haptics.navigate(); else haptics.read() }
    // give the tab a moment to mount (and its camera to start) before it gets the command
    setTimeout(() => send(c), target !== tab ? 400 : 0)
  }

  const mic = () => {
    haptics.tap()
    if (listening) { stopListening.current?.(); return }
    if (!canListen()) { say(t('noVoiceInput'), 'answer'); return }
    stop()            // never listen while talking: it would hear itself
    setHeard('')
    beep(880, 70, 0.2) // "speak now"
    setListening(true)
    stopListening.current = listen(
      (alts) => { setHeard(alts[0]); handle(parseAlternatives(alts, mode)) },
      (ok, err) => {
        setListening(false); stopListening.current = null
        if (!ok) say(err === 'not-allowed' || err === 'service-not-allowed' ? t('micDenied') : t('notUnderstood'), 'answer')
      },
    )
  }

  // the language pill cycles EN -> हिं -> ਪੰ (Settings has the full list)
  const nextLang = () => {
    const l = LANGS[(LANGS.findIndex((x) => x.code === lang) + 1) % LANGS.length].code
    setLang(l); setVoiceIssue(null); say(t('languageSet', {}, l), 'info', l)
  }

  const status = listening ? t('listening') : busy ? t('thinking') : caption.speaking ? t('speaking') : t('readyChip')
  const statusKind = listening ? 'listening' : busy ? 'thinking' : caption.speaking ? 'speaking' : 'ready'
  const title = { navigate: t('navTitle'), read: t('readTitle'), say: t('tabSay'), settings: t('tabSettings') }[tab]
  const langNow = LANGS.find((x) => x.code === lang) ?? LANGS[0]
  const tabBtn = (x: Tab, icon: IconName, label: string) => (
    <button type="button" className={`tab ${tab === x ? 'on' : ''}`} aria-current={tab === x ? 'page' : undefined} onClick={() => go(x)}>
      <Icon name={icon} size={22} /><span>{label}</span>
    </button>
  )

  return (
    <div className="app" lang={lang}>
      <header className="topbar">
        <button type="button" className="round" onClick={() => { haptics.tap(); repeat() }} aria-label={t('repeat')}><Icon name="repeat" /></button>
        <h1 className="title">{title}</h1>
        <button type="button" className="lang-pill" onClick={nextLang} aria-label={`${langNow.name}. ${t('language')}`}>{langNow.label}</button>
      </header>

      {server === 'down' && (
        <div className="hero g-coral banner" role="alert">
          <b>{t('serverDown')}</b>
          <span>{t('serverHelp')}</span>
        </div>
      )}
      {voiceIssue && voiceIssue === lang && server === 'up' && (
        <div className="card banner" role="status">
          <span>{t('voiceMissing', { lang: langNow.name })}</span>
        </div>
      )}

      <main className="content">
        {tab === 'navigate' && <NavigateMode command={command} />}
        {tab === 'read' && <ReadMode command={command} shared={shared} />}
        {tab === 'say' && <SayTab onTry={(c) => { haptics.tap(); handle(c) }} />}
        {tab === 'settings' && <SettingsTab lang={lang} />}
      </main>

      <div className="bottom">
        <div className={`caption ${caption.speaking && caption.priority === 'alert' ? 'alert' : ''}`}>
          <div className="caption-text" role="status" aria-live="polite">
            <span className={`status status-${statusKind}`}>{status}</span>
            <p>{caption.text || t('hint')}</p>
            {heard && <small className="heard">{t('heard', { text: heard })}</small>}
          </div>
          <button type="button" className="round dark" onClick={() => { haptics.tap(); stop(); send({ cmd: 'stop' }) }} aria-label={t('stop')}>
            <Icon name="stop" />
          </button>
        </div>
        <nav className="dock" aria-label="Saathi">
          {tabBtn('navigate', 'nav', t('navTitle'))}
          {tabBtn('read', 'read', t('readTitle'))}
          <button type="button" className={`orb ${listening ? 'live' : ''}`} onClick={mic} aria-pressed={listening} aria-label={listening ? t('listening') : t('mic')}>
            <Icon name="mic" size={28} />
          </button>
          {tabBtn('say', 'say', t('tabSay'))}
          {tabBtn('settings', 'gear', t('tabSettings'))}
        </nav>
      </div>
    </div>
  )
}
