// Settings tab: language, which alerts to give, vibration and voice speed. Every change is said out loud.
import type { Lang, Speed } from '../core/settings'
import { canVibrate, setHazards, setLang, setObstacles, setSpeed, setVibrate } from '../core/settings'
import { useSettings } from '../core/useSettings'
import { say } from '../core/speech'
import { haptics } from '../core/haptics'
import Segmented from '../components/Segmented'
import { t } from '../i18n/phrases'

const LANGS: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'हिन्दी' }, { code: 'pa', name: 'ਪੰਜਾਬੀ' },
]

export default function SettingsTab({ lang }: { lang: Lang }) {
  const s = useSettings()
  const vib = canVibrate()
  const chooseLang = (l: Lang) => { setLang(l); say(t('languageSet', {}, l), 'info', l) }
  const toggle = (which: 'obstacles' | 'hazards' | 'vibrate') => {
    haptics.tap()
    if (which === 'obstacles') { setObstacles(!s.obstacles); say(!s.obstacles ? t('obstaclesOn') : t('obstaclesOff'), 'info') }
    if (which === 'hazards') { setHazards(!s.hazards); say(!s.hazards ? t('hazardsOn') : t('hazardsOff'), 'info') }
    if (which === 'vibrate') {
      if (!vib) { say(t('vibrationUnsupported'), 'answer'); return }
      setVibrate(!s.vibrate)
      if (!s.vibrate) haptics.test()
      say(!s.vibrate ? t('vibrationOn') : t('vibrationOff'), 'info')
    }
  }
  const speed = (v: Speed) => { setSpeed(v); say(t('speedSet', { s: t(v) }), 'info') }

  return (
    <div className="mode settings">
      <section className="hero g-pink">
        <span className="hero-label">{t('language')}</span>
        <p className="hero-headline">{t('langQ')}</p>
        <div className="lang-row" role="group" aria-label={t('language')}>
          {LANGS.map((l) => (
            <button key={l.code} type="button" lang={l.code} className={lang === l.code ? 'on' : ''} aria-pressed={lang === l.code}
              onClick={() => chooseLang(l.code)}>{l.name}</button>
          ))}
        </div>
      </section>

      <h3 className="section-title">{t('alertsTitle')}</h3>
      <div className="chip-row wrap">
        <button type="button" className={`chip ${s.obstacles ? 'on' : ''}`} aria-pressed={s.obstacles} onClick={() => toggle('obstacles')}>{t('obstacles')}</button>
        <button type="button" className={`chip ${s.hazards ? 'on' : ''}`} aria-pressed={s.hazards} onClick={() => toggle('hazards')}>{t('hazardsChip')}</button>
        <button type="button" className={`chip ${s.vibrate && vib ? 'on' : ''}`} aria-pressed={s.vibrate && vib} onClick={() => toggle('vibrate')}>
          {t('vibration')}{vib ? '' : ' —'}</button>
      </div>

      <h3 className="section-title">{t('voiceSpeed')}</h3>
      <Segmented label={t('voiceSpeed')} value={s.speed} onChange={speed} items={[
        { id: 'slow', label: t('slow') }, { id: 'normal', label: t('normal') }, { id: 'fast', label: t('fast') },
      ]} />
    </div>
  )
}
