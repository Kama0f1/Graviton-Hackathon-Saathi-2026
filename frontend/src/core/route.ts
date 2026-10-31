// Walking directions, all on the phone: GPS + compass, place search (OpenStreetMap / Photon)
// and a walking route (OSRM foot). Speaks each turn early ("In 40 metres, turn left") and again at the turn,
// re-routes if the person drifts off, and says which way to face using the compass when it can.
import { getLang, type Lang } from './settings'
import { say } from './speech'
import { haptics } from './haptics'
import { beep } from './audio'

export type LatLon = [number, number] // [lat, lon]
export type Step = { type: string; modifier?: string; name: string; at: LatLon; distance: number; exit?: number }
export type Route = { distance: number; duration: number; steps: Step[]; line: LatLon[] }
export type RouteView = {
  status: 'idle' | 'locating' | 'searching' | 'active' | 'arrived' | 'error'
  place?: string
  arrow?: string        // big arrow for the next move
  instruction?: string  // what to do next
  toNext?: number       // metres to the next turn
  remaining?: number    // metres to the destination
  error?: string
}

const PHOTON = 'https://photon.komoot.io'
const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'

// ---------------- phrases ----------------
type Ph = {
  turn: Record<string, string>; on: (base: string, name: string) => string
  roundabout: string; arrive: string; arriveSide: Record<string, string>
  inM: string; going: string; m: string; km: string; min: string
  start: Record<'ahead' | 'left' | 'right' | 'behind', string>; head: string; cardinal: string[]
  noGps: string; notFound: string; noRoute: string; offRoute: string; stopped: string; searching: string
  here: string; hereOn: string; whereTo: string; keepGoing: string; noRouteActive: string; weakGps: string
}
const PH: Record<Lang, Ph> = {
  en: {
    turn: { left: 'Turn left', right: 'Turn right', 'slight left': 'Keep slightly left', 'slight right': 'Keep slightly right',
      'sharp left': 'Turn sharp left', 'sharp right': 'Turn sharp right', straight: 'Go straight', uturn: 'Turn around' },
    on: (b, n) => `${b} onto ${n}`,
    roundabout: 'At the roundabout, take exit {n}', arrive: 'You have arrived at {place}.',
    arriveSide: { left: 'It is on your left.', right: 'It is on your right.' },
    inM: 'In {n} metres, {what}.', going: 'Going to {place}. {dist}, about {min} walking.',
    m: '{n} metres', km: '{n} kilometres', min: '{n} minutes',
    start: { ahead: 'Walk straight ahead.', left: 'Turn to your left, then walk.', right: 'Turn to your right, then walk.', behind: 'Turn around, then walk.' },
    head: 'Walk towards the {dir}.', cardinal: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
    noGps: 'I cannot get your location. Turn on location and allow it for Saathi.',
    notFound: 'I could not find {place} nearby. Try another name.', noRoute: 'I could not find a walking route there.',
    offRoute: 'You are off the route. Finding a new way.', stopped: 'Directions stopped.', searching: 'Finding {place}.',
    here: 'You are near {name}.', hereOn: 'You are on {street}, near {name}.', whereTo: 'Where do you want to go?',
    keepGoing: 'Keep going. {n} metres to the next turn.', noRouteActive: 'No directions running. Say: take me to, and a place.',
    weakGps: 'GPS signal is weak. Directions may be late.',
  },
  hi: {
    turn: { left: 'बाएं मुड़ें', right: 'दाएं मुड़ें', 'slight left': 'थोड़ा बाएं चलें', 'slight right': 'थोड़ा दाएं चलें',
      'sharp left': 'पूरा बाएं मुड़ें', 'sharp right': 'पूरा दाएं मुड़ें', straight: 'सीधे चलें', uturn: 'पीछे मुड़ें' },
    on: (b, n) => `${b}, ${n} पर`,
    roundabout: 'गोल चक्कर पर {n} नंबर रास्ता लें', arrive: 'आप {place} पहुँच गए हैं।',
    arriveSide: { left: 'यह आपकी बाईं ओर है।', right: 'यह आपकी दाईं ओर है।' },
    inM: '{n} मीटर बाद, {what}।', going: '{place} जा रहे हैं। {dist}, लगभग {min} पैदल।',
    m: '{n} मीटर', km: '{n} किलोमीटर', min: '{n} मिनट',
    start: { ahead: 'सीधे आगे चलें।', left: 'अपनी बाईं ओर मुड़कर चलें।', right: 'अपनी दाईं ओर मुड़कर चलें।', behind: 'पीछे मुड़कर चलें।' },
    head: '{dir} की ओर चलें।', cardinal: ['उत्तर', 'उत्तर-पूर्व', 'पूर्व', 'दक्षिण-पूर्व', 'दक्षिण', 'दक्षिण-पश्चिम', 'पश्चिम', 'उत्तर-पश्चिम'],
    noGps: 'आपकी लोकेशन नहीं मिल रही। लोकेशन चालू करें और साथी को अनुमति दें।',
    notFound: 'आस-पास {place} नहीं मिला। कोई और नाम बोलें।', noRoute: 'वहाँ तक पैदल रास्ता नहीं मिला।',
    offRoute: 'आप रास्ते से हट गए हैं। नया रास्ता ढूँढा जा रहा है।', stopped: 'दिशा-निर्देश बंद।', searching: '{place} ढूँढ रहे हैं।',
    here: 'आप {name} के पास हैं।', hereOn: 'आप {street} पर हैं, {name} के पास।', whereTo: 'आप कहाँ जाना चाहते हैं?',
    keepGoing: 'चलते रहें। अगला मोड़ {n} मीटर पर।', noRouteActive: 'कोई रास्ता नहीं चल रहा। बोलें: मुझे ले चलो, और जगह का नाम।',
    weakGps: 'जीपीएस सिग्नल कमज़ोर है। निर्देश देर से आ सकते हैं।',
  },
  pa: {
    turn: { left: 'ਖੱਬੇ ਮੁੜੋ', right: 'ਸੱਜੇ ਮੁੜੋ', 'slight left': 'ਥੋੜ੍ਹਾ ਖੱਬੇ ਚੱਲੋ', 'slight right': 'ਥੋੜ੍ਹਾ ਸੱਜੇ ਚੱਲੋ',
      'sharp left': 'ਪੂਰਾ ਖੱਬੇ ਮੁੜੋ', 'sharp right': 'ਪੂਰਾ ਸੱਜੇ ਮੁੜੋ', straight: 'ਸਿੱਧੇ ਚੱਲੋ', uturn: 'ਪਿੱਛੇ ਮੁੜੋ' },
    on: (b, n) => `${b}, ${n} 'ਤੇ`,
    roundabout: 'ਗੋਲ ਚੱਕਰ \'ਤੇ {n} ਨੰਬਰ ਰਸਤਾ ਲਓ', arrive: 'ਤੁਸੀਂ {place} ਪਹੁੰਚ ਗਏ ਹੋ।',
    arriveSide: { left: 'ਇਹ ਤੁਹਾਡੇ ਖੱਬੇ ਪਾਸੇ ਹੈ।', right: 'ਇਹ ਤੁਹਾਡੇ ਸੱਜੇ ਪਾਸੇ ਹੈ।' },
    inM: '{n} ਮੀਟਰ ਬਾਅਦ, {what}।', going: '{place} ਜਾ ਰਹੇ ਹਾਂ। {dist}, ਲਗਭਗ {min} ਪੈਦਲ।',
    m: '{n} ਮੀਟਰ', km: '{n} ਕਿਲੋਮੀਟਰ', min: '{n} ਮਿੰਟ',
    start: { ahead: 'ਸਿੱਧੇ ਅੱਗੇ ਚੱਲੋ।', left: 'ਆਪਣੇ ਖੱਬੇ ਮੁੜ ਕੇ ਚੱਲੋ।', right: 'ਆਪਣੇ ਸੱਜੇ ਮੁੜ ਕੇ ਚੱਲੋ।', behind: 'ਪਿੱਛੇ ਮੁੜ ਕੇ ਚੱਲੋ।' },
    head: '{dir} ਵੱਲ ਚੱਲੋ।', cardinal: ['ਉੱਤਰ', 'ਉੱਤਰ-ਪੂਰਬ', 'ਪੂਰਬ', 'ਦੱਖਣ-ਪੂਰਬ', 'ਦੱਖਣ', 'ਦੱਖਣ-ਪੱਛਮ', 'ਪੱਛਮ', 'ਉੱਤਰ-ਪੱਛਮ'],
    noGps: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਮਿਲ ਰਹੀ। ਲੋਕੇਸ਼ਨ ਚਾਲੂ ਕਰੋ ਅਤੇ ਸਾਥੀ ਨੂੰ ਇਜਾਜ਼ਤ ਦਿਓ।',
    notFound: 'ਨੇੜੇ {place} ਨਹੀਂ ਮਿਲਿਆ। ਕੋਈ ਹੋਰ ਨਾਂ ਬੋਲੋ।', noRoute: 'ਉੱਥੇ ਤੱਕ ਪੈਦਲ ਰਸਤਾ ਨਹੀਂ ਮਿਲਿਆ।',
    offRoute: 'ਤੁਸੀਂ ਰਸਤੇ ਤੋਂ ਹਟ ਗਏ ਹੋ। ਨਵਾਂ ਰਸਤਾ ਲੱਭਿਆ ਜਾ ਰਿਹਾ ਹੈ।', stopped: 'ਦਿਸ਼ਾ-ਨਿਰਦੇਸ਼ ਬੰਦ।', searching: '{place} ਲੱਭ ਰਹੇ ਹਾਂ।',
    here: 'ਤੁਸੀਂ {name} ਦੇ ਨੇੜੇ ਹੋ।', hereOn: 'ਤੁਸੀਂ {street} \'ਤੇ ਹੋ, {name} ਦੇ ਨੇੜੇ।', whereTo: 'ਤੁਸੀਂ ਕਿੱਥੇ ਜਾਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
    keepGoing: 'ਚੱਲਦੇ ਰਹੋ। ਅਗਲਾ ਮੋੜ {n} ਮੀਟਰ \'ਤੇ।', noRouteActive: 'ਕੋਈ ਰਸਤਾ ਨਹੀਂ ਚੱਲ ਰਿਹਾ। ਬੋਲੋ: ਮੈਨੂੰ ਲੈ ਚੱਲੋ, ਅਤੇ ਥਾਂ ਦਾ ਨਾਂ।',
    weakGps: 'ਜੀਪੀਐਸ ਸਿਗਨਲ ਕਮਜ਼ੋਰ ਹੈ। ਨਿਰਦੇਸ਼ ਦੇਰ ਨਾਲ ਆ ਸਕਦੇ ਹਨ।',
  },
}
const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), s)
export const rp = (key: Exclude<keyof Ph, 'turn' | 'on' | 'arriveSide' | 'start' | 'cardinal'>, v: Record<string, string | number> = {}, lang = getLang()) =>
  fill(PH[lang][key] as string, v)

// ---------------- geometry ----------------
const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180
export function dist(a: LatLon, b: LatLon) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export function bearing(a: LatLon, b: LatLon) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]))
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
// distance from p to the route line (flat-earth is fine at street scale)
export function distToLine(p: LatLon, line: LatLon[]) {
  if (line.length < 2) return line.length ? dist(p, line[0]) : Infinity
  const k = Math.cos(rad(p[0]))
  const toXY = (q: LatLon) => [rad(q[1]) * k * R, rad(q[0]) * R]
  const [px, py] = toXY(p)
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = toXY(line[i]), [bx, by] = toXY(line[i + 1])
    const dx = bx - ax, dy = by - ay
    const len = dx * dx + dy * dy
    const u = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
    best = Math.min(best, Math.hypot(px - (ax + u * dx), py - (ay + u * dy)))
  }
  return best
}
export const inMetres = (m: number, what: string, lang = getLang()) =>
  fill(PH[lang].inM, { n: roundTo(m), what: lang === 'en' ? what.charAt(0).toLowerCase() + what.slice(1) : what })
export const roundTo = (m: number) => (m >= 300 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10))
export function sayDist(m: number, lang = getLang()) {
  return m >= 1000 ? fill(PH[lang].km, { n: (Math.round(m / 100) / 10).toLocaleString('en-IN') }) : fill(PH[lang].m, { n: roundTo(m) })
}

// ---------------- instructions ----------------
const ARROWS: Record<string, string> = {
  left: '←', right: '→', 'slight left': '↖', 'slight right': '↗', 'sharp left': '↙', 'sharp right': '↘', straight: '↑', uturn: '↓',
}
export function arrowFor(s: Step) {
  if (s.type === 'arrive') return '◉'
  if (s.type === 'roundabout' || s.type === 'rotary') return '⟳'
  return ARROWS[s.modifier ?? 'straight'] ?? '↑'
}
export function stepText(s: Step, place: string, lang = getLang()): string {
  const p = PH[lang]
  if (s.type === 'arrive') return [fill(p.arrive, { place }), s.modifier && p.arriveSide[s.modifier] ? p.arriveSide[s.modifier] : ''].filter(Boolean).join(' ')
  if (s.type === 'roundabout' || s.type === 'rotary' || s.type === 'exit roundabout') return fill(p.roundabout, { n: s.exit ?? 1 })
  let mod = s.modifier ?? 'straight'
  if ((s.type === 'continue' || s.type === 'new name') && !mod.includes('left') && !mod.includes('right')) mod = 'straight'
  const base = p.turn[mod] ?? p.turn.straight
  return s.name ? p.on(base, s.name) : base
}
// "which way do I face first": compass heading vs the direction of the route
export function startText(from: LatLon, toward: LatLon, heading: number | null, lang = getLang()) {
  const b = bearing(from, toward)
  const p = PH[lang]
  if (heading == null) return fill(p.head, { dir: p.cardinal[Math.round(b / 45) % 8] })
  const rel = ((b - heading + 540) % 360) - 180 // -180..180, + = to the right
  const key = Math.abs(rel) <= 35 ? 'ahead' : Math.abs(rel) >= 145 ? 'behind' : rel > 0 ? 'right' : 'left'
  return p.start[key]
}

// ---------------- network ----------------
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }
const label = (pr: Record<string, string | undefined>) => pr.name || [pr.street, pr.housenumber].filter(Boolean).join(' ') || pr.city || ''

export async function findPlace(q: string, near: LatLon): Promise<{ name: string; at: LatLon } | null> {
  const pick = (cands: { name: string; at: LatLon }[]) => {
    const ok = cands.filter((c) => c.name && dist(near, c.at) < 60000)
    // the search is already biased to where you are; among the top few, prefer the nearest
    return ok.slice(0, 4).sort((a, b) => dist(near, a.at) - dist(near, b.at))[0] ?? null
  }
  try {
    const r = await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&lat=${near[0]}&lon=${near[1]}&limit=6`, { signal: AbortSignal.timeout(8000) })
    if (r.ok) {
      const j = (await r.json()) as { features: PhotonFeature[] }
      const best = pick(j.features.map((f) => ({ name: label(f.properties), at: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as LatLon })))
      if (best) return best
    }
  } catch { /* try the next search */ }
  try {
    const d = 0.35
    const vb = [near[1] - d, near[0] + d, near[1] + d, near[0] - d].join(',')
    const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}&viewbox=${vb}`, { signal: AbortSignal.timeout(8000) })
    if (r.ok) {
      const j = (await r.json()) as { name?: string; display_name: string; lat: string; lon: string }[]
      return pick(j.map((x) => ({ name: x.name || x.display_name.split(',')[0], at: [Number(x.lat), Number(x.lon)] as LatLon })))
    }
  } catch { /* nothing found */ }
  return null
}

type OsrmStep = { maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number }; name: string; distance: number }
export async function walkingRoute(from: LatLon, to: LatLon): Promise<Route | null> {
  try {
    const r = await fetch(`${OSRM}/${from[1]},${from[0]};${to[1]},${to[0]}?steps=true&overview=full&geometries=geojson`, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) return null
    const j = (await r.json()) as { code: string; routes: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] }
    const rt = j.code === 'Ok' ? j.routes[0] : undefined
    if (!rt) return null
    const steps: Step[] = rt.legs.flatMap((l) => l.steps).map((s) => ({
      type: s.maneuver.type, modifier: s.maneuver.modifier, name: s.name || '', exit: s.maneuver.exit,
      at: [s.maneuver.location[1], s.maneuver.location[0]], distance: s.distance,
    }))
    // OSRM sends "continue straight on the same road" steps: they are noise for someone walking
    const useful: Step[] = []
    for (const [n, s] of steps.entries()) {
      const noise = n > 0 && s.type !== 'arrive' && s.modifier === 'straight' && (s.type === 'continue' || s.type === 'new name')
      if (noise && useful.length) useful[useful.length - 1].distance += s.distance // keep the total right
      else useful.push(s)
    }
    return { distance: rt.distance, duration: rt.duration, steps: useful, line: rt.geometry.coordinates.map(([lon, lat]) => [lat, lon]) }
  } catch { return null }
}

export async function whereAmI(at: LatLon, lang = getLang()): Promise<string> {
  try {
    const r = await fetch(`${PHOTON}/reverse?lat=${at[0]}&lon=${at[1]}&limit=1`, { signal: AbortSignal.timeout(8000) })
    const f = ((await r.json()) as { features: PhotonFeature[] }).features[0]
    if (!f) throw new Error('none')
    const pr = f.properties
    const name = pr.name || pr.district || pr.city || ''
    if (pr.street && name && pr.street !== name) return fill(PH[lang].hereOn, { street: pr.street, name })
    return fill(PH[lang].here, { name: name || pr.street || pr.city || '' })
  } catch { return PH[lang].noGps }
}

// ---------------- sensors ----------------
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((ok, fail) => {
    if (!navigator.geolocation) { fail(new Error('no gps')); return }
    navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 })
  })
}
const toLL = (p: GeolocationPosition): LatLon => [p.coords.latitude, p.coords.longitude]

let heading: number | null = null
let compassOn = false
function onOrient(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
  if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading
  else if (e.absolute && e.alpha != null) heading = (360 - e.alpha) % 360
}
// must be called from a tap (iPhone asks for permission)
export async function startCompass() {
  if (compassOn) return
  compassOn = true
  try {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof D.requestPermission === 'function') await D.requestPermission()
  } catch { /* no permission: fall back to north/south/east/west */ }
  window.addEventListener('deviceorientationabsolute', onOrient as EventListener)
  window.addEventListener('deviceorientation', onOrient as EventListener)
}
export const getHeading = () => heading

// ---------------- the live guide ----------------
const AT_TURN = 14      // m: "turn now"
const EARLY = 45        // m: "in 40 metres, turn ..."
const OFF_ROUTE = 35    // m from the line, 3 fixes in a row -> new route
const REASSURE_MS = 90000

export function startDirections(place: string, onView: (v: RouteView) => void): () => void {
  let active = true
  let watch: number | null = null
  let route: Route | null = null
  let dest: { name: string; at: LatLon } | null = null
  let i = 1            // index of the next maneuver
  let early = -1       // index already pre-announced
  let offCount = 0
  let lastReroute = 0
  let lastSpoke = Date.now()
  let warnedGps = false
  const lang = getLang()
  const view = (v: RouteView) => { if (active) onView(v) }
  const fail = (msg: string) => { view({ status: 'error', place, error: msg }); say(msg, 'answer'); stop() }

  const show = (toNext: number) => {
    if (!route || !dest) return
    const s = route.steps[i]
    const remaining = toNext + route.steps.slice(i).reduce((a, x) => a + x.distance, 0)
    view({ status: 'active', place: dest.name, arrow: arrowFor(s), instruction: stepText(s, dest.name, lang), toNext, remaining })
  }

  const plan = async (from: LatLon, first: boolean) => {
    if (!dest) return
    const r = await walkingRoute(from, dest.at)
    if (!active) return
    if (!r || r.steps.length < 2) { fail(PH[lang].noRoute); return }
    route = r; i = 1; early = -1; offCount = 0
    // which way to start walking: a point ~15 m along the route (the first metres of GPS lines are noisy)
    const toward = r.line.find((q) => dist(from, q) >= 15) ?? r.steps[1].at
    const startHint = startText(from, toward, getHeading(), lang)
    const first1 = route.steps[1]
    const d1 = dist(from, first1.at)
    const next = first1.type === 'arrive' ? '' : ' ' + inMetres(d1, stepText(first1, dest.name, lang), lang)
    const intro = first
      ? fill(PH[lang].going, { place: dest.name, dist: sayDist(r.distance, lang), min: fill(PH[lang].min, { n: Math.max(1, Math.round(r.duration / 60)) }) }) + ' '
      : ''
    say(intro + startHint + next, 'answer') // one line: never two answers fighting
    if (first1.type !== 'arrive' && d1 < EARLY + 10) early = 1
    lastSpoke = Date.now()
    haptics.success()
    show(d1)
  }

  const onFix = (p: GeolocationPosition) => {
    if (!active || !route || !dest) return
    const pos = toLL(p)
    const acc = p.coords.accuracy
    if (acc > 60) { if (!warnedGps) { warnedGps = true; say(PH[lang].weakGps, 'info') } return }
    const s = route.steps[i]
    const d = dist(pos, s.at)
    // arrived / at the turn
    if (d <= Math.max(AT_TURN, acc * 0.6) || (s.type === 'arrive' && d <= 20)) {
      beep(1000, 120, 0.25)
      haptics.warning()
      say(stepText(s, dest.name, lang), 'alert')
      lastSpoke = Date.now()
      if (s.type === 'arrive') { view({ status: 'arrived', place: dest.name, arrow: '◉', instruction: stepText(s, dest.name, lang), toNext: 0, remaining: 0 }); stop(); return }
      i++
      show(dist(pos, route.steps[i].at))
      return
    }
    // early warning
    if (d <= EARLY && early !== i && s.type !== 'arrive') {
      early = i
      haptics.near()
      say(inMetres(d, stepText(s, dest.name, lang), lang), 'answer')
      lastSpoke = Date.now()
    }
    // drifted off the route?
    if (distToLine(pos, route.line) > Math.max(OFF_ROUTE, acc)) offCount++; else offCount = 0
    if (offCount >= 3 && Date.now() - lastReroute > 20000) {
      lastReroute = Date.now(); offCount = 0
      say(PH[lang].offRoute, 'answer')
      void plan(pos, false)
      return
    }
    // long straight stretch: a quiet "keep going" so the person knows it still works
    if (Date.now() - lastSpoke > REASSURE_MS) { lastSpoke = Date.now(); say(fill(PH[lang].keepGoing, { n: roundTo(d) }), 'info') }
    show(d)
  }

  const stop = () => {
    active = false
    if (watch != null) navigator.geolocation.clearWatch(watch)
    watch = null
  }

  ;(async () => {
    void startCompass()
    view({ status: 'locating', place })
    let pos: LatLon
    try { pos = toLL(await getPosition()) } catch { fail(PH[lang].noGps); return }
    if (!active) return
    view({ status: 'searching', place })
    say(fill(PH[lang].searching, { place }), 'info')
    dest = await findPlace(place, pos)
    if (!active) return
    if (!dest) { fail(fill(PH[lang].notFound, { place })); return }
    await plan(pos, true)
    if (!active) return
    watch = navigator.geolocation.watchPosition(onFix, () => undefined, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 })
  })()

  return () => { if (active) { stop(); say(PH[lang].stopped, 'info'); view({ status: 'idle' }) } }
}
