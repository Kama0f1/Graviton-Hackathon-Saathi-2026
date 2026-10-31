// App-wide settings: language and the session id sent with every request.
export type Lang = 'en' | 'hi' | 'pa';

function load(): Lang {
  try {
    const v = localStorage.getItem('saathi.lang');
    if (v === 'en' || v === 'hi' || v === 'pa') return v;
  } catch { /* storage blocked */ }
  return 'en';
}

let lang: Lang = load();
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('saathi.lang', l); } catch { /* ignore */ }
}

// One id per app start; the backend uses it to remember the last bill and the amount paid.
export const sessionId: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
