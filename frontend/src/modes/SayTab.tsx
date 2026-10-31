// Say tab: every voice command as a list. Tapping a line runs it, so the list also teaches what to say.
import { useState } from 'react'
import type { Command } from '../core/listen'
import { t, type PhraseKey } from '../i18n/phrases'
import Icon from '../components/Icon'

type Group = 'walk' | 'read' | 'money'
type Line = { key: string; group: Group | 'any'; cmd: Command; color: string }
const LINES: Line[] = [
  { key: 'ahead', group: 'walk', cmd: { cmd: 'ahead' }, color: 'purple' },
  { key: 'route', group: 'walk', cmd: { cmd: 'route', place: 'bus stand' }, color: 'blue' },
  { key: 'where', group: 'walk', cmd: { cmd: 'whereAmI' }, color: 'blue' },
  { key: 'sign', group: 'walk', cmd: { cmd: 'sign' }, color: 'green' },
  { key: 'bin', group: 'walk', cmd: { cmd: 'bin' }, color: 'green' },
  { key: 'findBin', group: 'walk', cmd: { cmd: 'findBin' }, color: 'green' },
  { key: 'read', group: 'read', cmd: { cmd: 'guide' }, color: 'purple' },
  { key: 'more', group: 'read', cmd: { cmd: 'more' }, color: 'purple' },
  { key: 'count', group: 'money', cmd: { cmd: 'count' }, color: 'coral' },
  { key: 'paid', group: 'money', cmd: { cmd: 'paid', amount: 500 }, color: 'coral' },
  { key: 'change', group: 'money', cmd: { cmd: 'change' }, color: 'coral' },
  { key: 'note', group: 'money', cmd: { cmd: 'note' }, color: 'pink' },
  { key: 'repeat', group: 'any', cmd: { cmd: 'repeat' }, color: 'ink' },
  { key: 'stop', group: 'any', cmd: { cmd: 'stop' }, color: 'ink' },
]

export default function SayTab({ onTry }: { onTry: (c: Command) => void }) {
  const [group, setGroup] = useState<Group | 'all'>('all')
  const groups: { id: Group | 'all'; label: string }[] = [
    { id: 'all', label: t('grpAll') }, { id: 'walk', label: t('grpWalk') }, { id: 'read', label: t('grpRead') }, { id: 'money', label: t('grpMoney') },
  ]
  return (
    <div className="mode say">
      <h2 className="two-tone"><span>{t('sayHead1')}</span> <span className="faint">{t('sayHead2')}</span></h2>
      <div className="chip-row" role="group" aria-label={t('tabSay')}>
        {groups.map((g) => (
          <button key={g.id} type="button" className={`chip ${group === g.id ? 'on' : ''}`} aria-pressed={group === g.id}
            onClick={() => setGroup(g.id)}>{g.label}</button>
        ))}
      </div>
      <ul className="card cmd-list">
        {LINES.filter((l) => group === 'all' || l.group === 'any' || l.group === group).map((l) => (
          <li key={l.key}>
            <button type="button" className="cmd" onClick={() => onTry(l.cmd)}>
              <span className={`play c-${l.color}`}><Icon name="play" size={16} /></span>
              <span className="cmd-text">
                <b>“{t(`c_${l.key}` as PhraseKey)}”</b>
                <small>{t(`d_${l.key}` as PhraseKey)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
