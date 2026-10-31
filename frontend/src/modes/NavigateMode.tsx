// Navigate mode: obstacle alerts on the phone (always on), walking directions (GPS),
// and backend actions: what's ahead (/describe), read sign (/sign), which bin (/waste) + the colour bin finder.
import { useEffect, useRef, useState } from 'react'
import CameraView from '../components/CameraView'
import ResultCard from '../components/ResultCard'
import { useCamera } from '../core/camera'
import { api, ApiError } from '../core/api'
import { say } from '../core/speech'
import { haptics } from '../core/haptics'
import { fromSign, fromSpeech, fromWaste, type ResultSrc, src } from '../core/result'
import type { Command } from '../core/listen'
import { useObstacles } from '../vision/detector'
import { useHazardWatch } from '../vision/hazardWatch'
import { startBinFinder, type BinColor } from '../vision/binFinder'
import { getPosition, inMetres, rp, sayDist, startCompass, startDirections, whereAmI, type RouteView } from '../core/route'
import { frame } from './useFrame'
import { t } from '../i18n/phrases'

export default function NavigateMode({ command }: { command: (Command & { id: number }) | null }) {
  const cam = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [obstacles, setObstacles] = useState(true)
  const [result, setResult] = useState<ResultSrc | null>(null)
  const [bin, setBin] = useState<BinColor | null>(null)
  const [finding, setFinding] = useState(false)
  const [route, setRoute] = useState<RouteView>({ status: 'idle' })
  const [asking, setAsking] = useState(false)   // the "where to?" box is open
  const [dest, setDest] = useState('')
  const stopFinder = useRef<(() => void) | null>(null)
  const stopRoute = useRef<(() => void) | null>(null)
  const routing = route.status === 'active' || route.status === 'locating' || route.status === 'searching'
  const { status, count, seen } = useObstacles(cam.videoRef, canvasRef, cam.on && obstacles && !finding, cam.mirrored, routing)
  // stairs, walls, kerbs, glass... (things the phone-side detector cannot see), checked by the AI every few seconds
  const hazard = useHazardWatch(cam.videoRef, cam.grab, cam.on && obstacles && !finding)

  useEffect(() => {
    void cam.start()
    return () => { stopFinder.current?.(); stopRoute.current?.(); cam.stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => { try { await fn() } catch (e) { if (!(e instanceof ApiError)) console.error(e) } }

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
  const findBin = () => {
    if (finding) { stopFinder.current?.(); stopFinder.current = null; setFinding(false); return }
    if (!bin) { say(t('binFirst'), 'answer'); return }
    if (!cam.videoRef.current) return
    stopFinder.current = startBinFinder(cam.videoRef.current, bin)
    setFinding(true)
  }
  const toggleObstacles = (on = !obstacles) => { setObstacles(on); say(on ? t('obstaclesOn') : t('obstaclesOff'), 'info') }

  const go = (place: string) => {
    place = place.trim()
    if (!place) return
    stopRoute.current?.()
    setAsking(false)
    setDest('')
    setResult(null)
    window.scrollTo({ top: 0 })
    stopRoute.current = startDirections(place, setRoute)
  }
  const endRoute = () => { stopRoute.current?.(); stopRoute.current = null; setRoute({ status: 'idle' }) }
  const openDirections = () => {
    void startCompass() // needs a tap on iPhone
    if (routing) { repeatStep(); return }  // while walking, the button repeats what to do now (End is on the panel)
    setAsking((a) => !a)
    if (!asking) say(rp('whereTo'), 'answer')
  }
  const repeatStep = () => {
    if (route.status === 'active' && route.instruction) {
      say(route.toNext != null && route.toNext > 15 ? inMetres(route.toNext, route.instruction) : route.instruction, 'answer')
    }
  }
  const locate = () => run(async () => {
    let pos: GeolocationPosition
    try { pos = await getPosition() } catch { say(rp('noGps'), 'answer'); return }
    const text = await whereAmI([pos.coords.latitude, pos.coords.longitude])
    setResult(src(() => ({ tone: 'info', label: t('lblPlace'), headline: text })))
    say(text, 'answer')
  })

  useEffect(() => {
    if (!command) return
    switch (command.cmd) {
      case 'ahead': void ahead(); break
      case 'sign': void sign(); break
      case 'bin': void whatBin(); break
      case 'findBin': findBin(); break
      case 'obstaclesOn': toggleObstacles(true); break
      case 'obstaclesOff': toggleObstacles(false); break
      case 'route': go(command.place); break
      case 'directions': if (routing) repeatStep(); else { setAsking(true); say(rp('whereTo'), 'answer') } break
      case 'whereAmI': void locate(); break
      case 'more': repeatStep(); break
      case 'stop': if (finding) findBin(); if (routing) endRoute(); break
    }
  }, [command?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const badge = finding ? t('findBin')
    : obstacles && hazard ? hazard.speech
    : obstacles ? (status || (seen ? `${seen.name} · ${t(seen.pos)}${seen.metres != null ? ` · ${seen.metres} m` : ''}${seen.close ? ' · !' : ''}${count > 1 ? `  +${count - 1}` : ''}` : t('nothingSeen')))
    : undefined

  return (
    <div className="mode">
      {route.status !== 'idle' && (
        <section className={`route route-${route.status}`} aria-live="polite">
          <button type="button" className="route-main" onClick={repeatStep}>
            <span className="route-arrow" aria-hidden="true">{route.status === 'active' || route.status === 'arrived' ? route.arrow : '…'}</span>
            <span className="route-text">
              <b>{route.status === 'locating' ? t('locating') : route.status === 'searching' ? t('searchingPlace')
                : route.status === 'error' ? route.error : route.instruction}</b>
              <small>
                {route.place}
                {route.status === 'active' && route.toNext != null && ` · ${t('nextIn', { d: sayDist(route.toNext) })}`}
                {route.status === 'active' && route.remaining != null && ` · ${t('toGo', { d: sayDist(route.remaining) })}`}
                {route.status === 'arrived' && ` · ${t('arrived')}`}
              </small>
            </span>
          </button>
          <button type="button" className="route-end" onClick={endRoute}>{t('endRoute')}</button>
        </section>
      )}

      <CameraView cam={cam} canvasRef={canvasRef} badge={badge} badgeAlert={((!!seen?.close) || !!hazard?.urgent) && obstacles && !finding} />

      {asking && !routing && (
        <form className="ask" onSubmit={(e) => { e.preventDefault(); go(dest) }}>
          <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder={t('whereTo')} aria-label={t('whereTo')} autoFocus enterKeyHint="go" />
          <button type="submit">{t('go')}</button>
        </form>
      )}

      <ResultCard src={result} />

      <div className="actions">
        <button type="button" className="btn primary full" onClick={() => void ahead()}>{t('ahead')}</button>
        <button type="button" className="btn" onClick={() => void sign()}>{t('sign')}</button>
        <button type="button" className="btn" onClick={() => void whatBin()}>{t('bin')}</button>
        <button type="button" className={`btn ${routing || asking ? 'on' : ''}`} aria-pressed={routing || asking} onClick={openDirections}>
          {t('directions')}</button>
        <button type="button" className="btn" onClick={() => void locate()}>{t('whereAmI')}</button>
      </div>
      <div className="toggles">
        <button type="button" className={`toggle ${obstacles ? 'on' : ''}`} aria-pressed={obstacles} onClick={() => toggleObstacles()}>
          {t('obstacles')}: <b>{obstacles ? t('on') : t('off')}</b></button>
        <button type="button" className={`toggle ${finding ? 'on' : ''}`} aria-pressed={finding} onClick={findBin} disabled={!bin && !finding}>
          {t('findBin')}{bin && !finding ? ` (${t(bin)})` : ''}</button>
      </div>
    </div>
  )
}
