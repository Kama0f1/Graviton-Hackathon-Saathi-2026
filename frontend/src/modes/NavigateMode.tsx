// Navigate tab: obstacle alerts on the phone (always on), stairs/walls watch, and four tools picked in a pill control:
// Ahead (/describe), Sign (/sign), Bin (/waste + colour bin finder) and Route (walking directions by GPS).
import { useEffect, useRef, useState } from 'react'
import CameraView from '../components/CameraView'
import ResultCard from '../components/ResultCard'
import Segmented from '../components/Segmented'
import Dots, { closeness } from '../components/Dots'
import Icon, { type IconName } from '../components/Icon'
import { useCamera } from '../core/camera'
import { api, ApiError } from '../core/api'
import { say } from '../core/speech'
import { haptics } from '../core/haptics'
import { fromSign, fromSpeech, fromWaste, type ResultSrc, src } from '../core/result'
import type { Command } from '../core/listen'
import { useSettings } from '../core/useSettings'
import { useObstacles } from '../vision/detector'
import { useHazardWatch } from '../vision/hazardWatch'
import { type BinColor } from '../vision/binFinder'
import { startAiBinFinder } from '../vision/aiBinFinder'
import { startCabFinder } from '../vision/cabFinder'
import type { CabResult } from '../core/api'
import { getPosition, inMetres, rp, sayDist, startCompass, startDirections, whereAmI, type RouteView } from '../core/route'
import { frame } from './useFrame'
import { t } from '../i18n/phrases'

type Tool = 'ahead' | 'sign' | 'bin' | 'route' | 'cab'
const TOOL_OF: Partial<Record<Command['cmd'], Tool>> = {
  ahead: 'ahead', sign: 'sign', bin: 'bin', findBin: 'bin', route: 'route', directions: 'route', whereAmI: 'route', cab: 'cab',
}
const TURN_ICON: Record<string, IconName> = {
  '←': 'turnLeft', '↖': 'turnLeft', '↙': 'turnLeft', '→': 'turnRight', '↗': 'turnRight', '↘': 'turnRight',
  '↓': 'uturn', '◉': 'flag',
}

export default function NavigateMode({ command }: { command: (Command & { id: number }) | null }) {
  const cam = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const set = useSettings()
  const [tool, setTool] = useState<Tool>('ahead')
  const [result, setResult] = useState<ResultSrc | null>(null)
  const [bin, setBin] = useState<BinColor | null>(null)
  const [finding, setFinding] = useState(false)
  const [route, setRoute] = useState<RouteView>({ status: 'idle' })
  const [dest, setDest] = useState('')
  const [plate, setPlate] = useState(() => { try { return localStorage.getItem('saathi.cab') ?? '' } catch { return '' } })
  const [cabbing, setCabbing] = useState(false)
  const [cabSeen, setCabSeen] = useState<CabResult | null>(null)
  const stopCab = useRef<(() => void) | null>(null)
  const total = useRef(0)               // route length at the start, for the progress dots
  const stopFinder = useRef<(() => void) | null>(null)
  const stopRoute = useRef<(() => void) | null>(null)
  const routing = route.status === 'active' || route.status === 'locating' || route.status === 'searching'
  const watching = cam.on && set.obstacles && !finding
  const { status, count, seen } = useObstacles(cam.videoRef, canvasRef, watching, cam.mirrored, routing)
  // stairs, walls, kerbs, glass... (things the phone-side detector cannot see), checked by the AI every few seconds
  const hazard = useHazardWatch(cam.videoRef, cam.grab, cam.on && set.hazards && !finding)

  useEffect(() => {
    void cam.start()
    return () => { stopFinder.current?.(); stopRoute.current?.(); stopCab.current?.(); cam.stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (route.status === 'active' && route.remaining != null && route.remaining > total.current) total.current = route.remaining
    if (route.status === 'idle') total.current = 0
  }, [route])

  const run = async (fn: () => Promise<void>) => { try { await fn() } catch (e) { if (!(e instanceof ApiError)) console.error(e) } }

  const pick = (x: Tool) => {
    haptics.tap()
    setTool(x)
    const name = { ahead: t('toolAhead'), sign: t('toolSign'), bin: t('toolBin'), route: t('toolRoute'), cab: t('toolCab') }[x]
    say(x === 'route' && !routing ? `${name}. ${rp('whereTo')}` : t('toolSet', { t: name }), 'info')
  }

  const ahead = () => run(async () => {
    const img = await frame(cam, 768, 0.8); if (!img) return
    const r = await api.describe(img); setResult(src(() => fromSpeech(t('lblAhead'), r))); say(r.speech, 'answer')
  })
  const sign = () => run(async () => {
    const img = await frame(cam, 1024, 0.85); if (!img) return
    const r = await api.sign(img); setResult(src(() => fromSign(r))); say(r.speech, 'answer')
  })
  const whatBin = () => run(async () => {
    const img = await frame(cam, 768, 0.8); if (!img) return
    const r = await api.waste(img); setResult(src(() => fromWaste(r))); say(r.speech, 'answer')
    setBin(r.bin_color)
    if (r.bin_color) haptics.success()
  })
  // Finds any dustbin (the AI looks), preferring the colour /waste asked for. No need to ask "which bin" first.
  const findBin = () => {
    if (finding) { stopFinder.current?.(); stopFinder.current = null; setFinding(false); say(t('binStop'), 'info'); return }
    setTool('bin')
    stopFinder.current = startAiBinFinder(cam.grab, bin)
    setFinding(true)
  }
  // "Is this my cab?": reads the plates in view until stopped
  const findCab = (p = plate) => {
    const clean = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    setTool('cab')
    if (cabbing && !p) { stopCab.current?.(); stopCab.current = null; setCabbing(false); setCabSeen(null); say(t('cabStop'), 'info'); return }
    if (clean.length < 4) { say(t('cabAsk'), 'answer'); return }
    setPlate(clean)
    try { localStorage.setItem('saathi.cab', clean) } catch { /* ignore */ }
    stopCab.current?.()
    stopCab.current = startCabFinder(cam.grab, clean, setCabSeen)
    setCabbing(true)
  }
  const stopCabbing = () => { stopCab.current?.(); stopCab.current = null; setCabbing(false); setCabSeen(null); say(t('cabStop'), 'info') }

  const go = (place: string) => {
    place = place.trim()
    if (!place) { say(rp('whereTo'), 'answer'); return }
    void startCompass() // needs a tap on iPhone
    stopRoute.current?.()
    setDest('')
    setResult(null)
    setTool('route')
    window.scrollTo({ top: 0 })
    stopRoute.current = startDirections(place, setRoute)
  }
  const endRoute = () => { stopRoute.current?.(); stopRoute.current = null; setRoute({ status: 'idle' }) }
  const repeatStep = () => {
    if (route.status === 'active' && route.instruction) {
      say(route.toNext != null && route.toNext > 15 ? inMetres(route.toNext, route.instruction) : route.instruction, 'answer')
    }
  }
  const locate = () => run(async () => {
    let pos: GeolocationPosition
    try { pos = await getPosition() } catch { say(rp('noGps'), 'answer'); return }
    const text = await whereAmI([pos.coords.latitude, pos.coords.longitude])
    setResult(src(() => ({ tone: 'info', accent: 'blue', label: t('lblPlace'), headline: text })))
    say(text, 'answer')
  })

  useEffect(() => {
    if (!command) return
    const to = TOOL_OF[command.cmd]
    if (to) setTool(to)
    switch (command.cmd) {
      case 'ahead': void ahead(); break
      case 'sign': void sign(); break
      case 'bin': void whatBin(); break
      case 'findBin': if (!finding) findBin(); break   // asking again while searching keeps searching
      case 'route': go(command.place); break
      case 'directions': if (routing) repeatStep(); else say(rp('whereTo'), 'answer'); break
      case 'whereAmI': void locate(); break
      case 'more': repeatStep(); break
      case 'cab': if (command.plate) findCab(command.plate); else if (!cabbing) { if (plate) findCab(plate); else say(t('cabAsk'), 'answer') } break
      case 'stop': if (finding) findBin(); if (routing) endRoute(); if (cabbing) stopCabbing(); break
    }
  }, [command?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // camera chip: what the phone sees right now
  const chip = finding ? t('findBin')
    : set.obstacles ? (status || (seen ? `${seen.name} · ${t(seen.pos)}${seen.metres != null ? ` · ${seen.metres} m` : ''}${count > 1 ? `  +${count - 1}` : ''}` : t('nothingSeen')))
    : `${t('obstacles')}: ${t('off')}`
  const chipTone = !set.obstacles ? 'idle' : seen?.close ? 'alert' : 'ok'
  const showRoute = route.status !== 'idle'
  const progress = route.status === 'arrived' ? 1 : total.current && route.remaining != null ? 1 - route.remaining / total.current : 0
  const hazardTitle = hazard ? (hazard.speech.includes(',') ? hazard.speech.slice(0, hazard.speech.lastIndexOf(',')) : hazard.speech) : ''

  const routeCard = showRoute && (
    <section className={`hero g-${route.status === 'error' ? 'coral' : route.status === 'arrived' ? 'green' : 'blue'} route route-${route.status}`} aria-live="polite">
      <div className="hero-top">
        <span className="hero-label">{route.status === 'arrived' ? t('arrived') : route.place ? t('routeTo', { p: route.place }) : t('nextTurn')}</span>
        {route.status === 'active' && route.remaining != null && <span className="hero-tag">{t('toGo', { d: sayDist(route.remaining) })}</span>}
        <button type="button" className="hero-end" onClick={endRoute}>{t('endRoute')}</button>
      </div>
      <button type="button" className="route-main" onClick={repeatStep}>
        <span className="route-icon"><Icon name={route.status === 'active' || route.status === 'arrived' ? TURN_ICON[route.arrow ?? ''] ?? 'straight' : 'pin'} size={30} /></span>
        <span className="route-text">
          <b>{route.status === 'locating' ? t('locating') : route.status === 'searching' ? t('searchingPlace')
            : route.status === 'error' ? route.error : route.instruction}</b>
          {route.status === 'active' && route.toNext != null && <small>{t('nextIn', { d: sayDist(route.toNext) })}</small>}
        </span>
      </button>
      {(route.status === 'active' || route.status === 'arrived') &&
        <Dots rows={2} className="progress" values={Array.from({ length: 30 }, (_, i) => (i < Math.round(progress * 30) ? 2 : 0))} />}
    </section>
  )
  const hazardCard = hazard && set.hazards && !finding && (
    <section className={`hero g-coral hazard ${hazard.urgent ? 'urgent' : ''}`} aria-hidden="true">
      <span className="hero-label"><Icon name="warn" size={18} />{t('hazardAhead')}</span>
      <div className="hazard-row">
        <p className="hero-headline">{hazardTitle}</p>
        <span className="big-num">{hazard.metres} m</span>
      </div>
      <Dots rows={4} values={closeness(1 - hazard.metres / 7, 30, 4)} />
    </section>
  )

  const cabCard = cabbing && (
    <section className={`hero ${cabSeen?.match ? 'g-green' : 'g-blue'} cab-card`} aria-hidden="true">
      <div className="hero-top">
        <span className="hero-label">{t('cabLabel')}</span>
        <span className="hero-tag plate">{plate}</span>
      </div>
      <p className="hero-headline">{cabSeen?.match ? t('cabFound') : cabSeen ? (cabSeen.plates.length ? t('cabNotYet') : t('cabNoPlate')) : t('cabSearching')}</p>
      {cabSeen?.match && <span className="hero-detail">{t(cabSeen.position === 'ahead' ? 'centre' : cabSeen.position)} · {cabSeen.metres} m</span>}
      {!cabSeen?.match && cabSeen && cabSeen.plates.length > 0 && <ul className="hero-chips">{cabSeen.plates.slice(0, 3).map((p) => <li key={p}>{p}</li>)}</ul>}
    </section>
  )

  return (
    <div className="mode camfirst">
      <CameraView cam={cam} canvasRef={canvasRef} chip={chip} chipTone={chipTone}
        top={<>{routeCard}{cabCard}<ResultCard src={result} onClose={() => setResult(null)} /></>}
        bottom={hazardCard} />

      <Segmented label={t('navTitle')} value={tool} onChange={pick} items={[
        { id: 'ahead', label: t('toolAhead') }, { id: 'sign', label: t('toolSign') },
        { id: 'bin', label: t('toolBin') }, { id: 'route', label: t('toolRoute') }, { id: 'cab', label: t('toolCab') },
      ]} />

      <div className="action-row">
        {tool === 'ahead' && <button type="button" className="pill-btn" onClick={() => void ahead()}><Icon name="eye" />{t('descAhead')}</button>}
        {tool === 'sign' && <button type="button" className="pill-btn" onClick={() => void sign()}><Icon name="sign" />{t('readSignBtn')}</button>}
        {tool === 'bin' && (
          <>
            <button type="button" className="pill-btn" onClick={() => void whatBin()}><Icon name="bin" />{t('bin')}</button>
            <button type="button" className={`pill-btn light ${finding ? 'on' : ''}`} aria-pressed={finding} onClick={findBin}>
              <Icon name={finding ? 'stop' : 'nav'} />{finding ? t('stop') : t('findBin')}</button>
          </>
        )}
        {tool === 'route' && (routing ? (
          <button type="button" className="pill-btn" onClick={repeatStep}><Icon name="repeat" />{t('repeatTurn')}</button>
        ) : (
          <form className="ask" onSubmit={(e) => { e.preventDefault(); go(dest) }}>
            <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder={t('whereTo')} aria-label={t('whereTo')} enterKeyHint="go" />
            <button type="submit" aria-label={t('go')}><Icon name="send" /></button>
          </form>
        ))}
        {tool === 'route' && <button type="button" className="round big" onClick={() => void locate()} aria-label={t('whereAmI')}><Icon name="pin" /></button>}
        {tool === 'cab' && (cabbing ? (
          <button type="button" className="pill-btn on" onClick={stopCabbing}><Icon name="stop" />{t('cabStopBtn')}</button>
        ) : (
          <form className="ask" onSubmit={(e) => { e.preventDefault(); findCab(plate) }}>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder={t('cabPlaceholder')} aria-label={t('cabPlaceholder')}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
            <button type="submit" aria-label={t('cabFindBtn')}><Icon name="send" /></button>
          </form>
        ))}
      </div>
    </div>
  )
}
