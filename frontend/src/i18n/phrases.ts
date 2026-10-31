// Fixed phrases spoken by the app itself (not from the backend).
import { getLang } from '../core/settings';

export const phrases = {
  en: {
    ready: 'Saathi ready. Navigate mode.',
    navigate: 'Navigate mode.',
    read: 'Read mode.',
    thinking: 'One moment.',
    offline: "I can't reach the server. Check the internet.",
    timeout: 'That is taking too long. Please try again.',
    error: "Sorry, I couldn't do that. Please try again.",
  },
  hi: {
    ready: 'साथी तैयार है। नेविगेट मोड।',
    navigate: 'नेविगेट मोड।',
    read: 'पढ़ने का मोड।',
    thinking: 'एक पल।',
    offline: 'सर्वर से जुड़ नहीं पा रहा। इंटरनेट जाँचें।',
    timeout: 'इसमें बहुत समय लग रहा है। फिर से कोशिश करें।',
    error: 'माफ़ कीजिए, यह नहीं हो पाया। फिर से कोशिश करें।',
  },
  pa: {
    ready: 'ਸਾਥੀ ਤਿਆਰ ਹੈ। ਨੈਵੀਗੇਟ ਮੋਡ।',
    navigate: 'ਨੈਵੀਗੇਟ ਮੋਡ।',
    read: 'ਪੜ੍ਹਨ ਮੋਡ।',
    thinking: 'ਇੱਕ ਪਲ।',
    offline: 'ਸਰਵਰ ਨਾਲ ਜੁੜ ਨਹੀਂ ਸਕਿਆ। ਇੰਟਰਨੈੱਟ ਜਾਂਚੋ।',
    timeout: 'ਇਸ ਵਿੱਚ ਬਹੁਤ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    error: 'ਮਾਫ਼ ਕਰਨਾ, ਇਹ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  },
} as const;

export type PhraseKey = keyof typeof phrases.en;
export const t = (key: PhraseKey) => phrases[getLang()][key];
