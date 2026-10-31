// Navigate mode: obstacle alerts on the phone (always on), plus backend actions:
// what's ahead (/describe), read sign (/sign), what bin (/waste) and the colour bin finder.
import { useEffect, useRef, useState } from 'react'
import CameraView from '../components/CameraView'
import ResultCard from '../components/ResultCard'
import { useCamera } from '../core/camera'
import { api, ApiError } from '../core/api'
import { say } from '../core/speech'
import { haptics } from '../core/haptics'
import { fromSign, fromSpeech, fromWaste, type ResultView } from '../core/result'
import type { Command } from '../core/listen'
import { useObstacles } from '../vision/detector'
import { startBinFinder, type BinColor } from '../vision/binFinder'
import { frame } from './useFrame'
import { t } from '../i18n/phrases'

export default function NavigateMode({ command }: { command: (Command & { id: number }) | null }) {
  const cam = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [obstacles, setObstacles] = useState(true)
  const [result, setResult] = useState<ResultView | null>(null)
  const [bin, setBin] = useState<BinColor | null>(null)
  const [finding, setFinding] = useState(false)
  const stopFinder = useRef<(() => void) | null>(null)
  const { status, count, seen } = useObstacles(cam.videoRef, canvasRef, cam.on && obstacles && !finding, cam.mirrored)

  useEffect(() => { void cam.start(); return () => { stopFinder.current?.(); cam.stop() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => { try { await fn() } catch (e) { if (!(e instanceof ApiError)) console.error(e) } }

  const ahead = () => run(async () => {
    const img = await frame(cam, 1024); if (!img) return
    const r = await api.describe(img); setResult(fromSpeech('AHEAD', r)); say(r.speech, 'answer')
  })
  const sign = () => run(async () => {
    const img = await frame(cam, 1280); if (!img) return
    const r = await api.sign(img); setResult(fromSign(r)); say(r.speech, 'answer')
  })
  const whatBin = () => run(async () => {
    const img = await frame(cam, 1024); if (!img) return
    const r = await api.waste(img); setResult(fromWaste(r)); say(r.speech, 'answer')
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

  useEffect(() => {
    if (!command) return
    switch (command.cmd) {
      case 'ahead': void ahead(); break
      case 'sign': void sign(); break
      case 'bin': void whatBin(); break
      case 'findBin': findBin(); break
      case 'obstaclesOn': toggleObstacles(true); break
      case 'obstaclesOff': toggleObstacles(false); break
      case 'stop': if (finding) findBin(); break
    }
  }, [command?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mode">
      <CameraView cam={cam} canvasRef={canvasRef}
        badge={finding ? `🔎 ${t('findBin')}` : obstacles ? (status || (seen ? `${seen.close ? '⚠ ' : '● '}${seen.name} · ${t(seen.pos)}${count > 1 ? ` (+${count - 1})` : ''}` : `● ${t('nothingSeen')}`)) : undefined}
        badgeAlert={!!seen?.close && obstacles && !finding} />
      <ResultCard r={result} />
      <div className="actions">
        <button type="button" className="action primary" onClick={() => void ahead()}><span aria-hidden="true">👁</span>{t('ahead')}</button>
        <button type="button" className="action" onClick={() => void sign()}><span aria-hidden="true">🪧</span>{t('sign')}</button>
        <button type="button" className="action" onClick={() => void whatBin()}><span aria-hidden="true">♻</span>{t('bin')}</button>
        <button type="button" className={`action ${finding ? 'on' : ''}`} aria-pressed={finding} onClick={findBin} disabled={!bin && !finding}>
          <span aria-hidden="true">🔎</span>{t('findBin')}</button>
        <button type="button" className={`action wide ${obstacles ? 'on' : ''}`} aria-pressed={obstacles} onClick={() => toggleObstacles()}>
          <span aria-hidden="true">⚠</span>{t('obstacles')}: {obstacles ? t('on') : t('off')}</button>
      </div>
    </div>
  )
}
