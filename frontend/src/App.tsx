
import { useState } from 'react'
import './App.css'
import NavigateMode from './modes/NavigateMode'

type Mode = 'navigate' | 'read' | null
type Language = 'en-IN' | 'hi-IN' | 'pa-IN'

const languages: { code: Language; label: string }[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
]

const messages = {
  'en-IN': {
    ready: 'Saathi is ready. Choose Navigate or Read mode.',
    navigate: 'Navigate mode selected.',
    read: 'Read mode selected.',
    home: 'Returning to home screen.',
    listening: 'Listening. Please speak.',
    unsupported: 'Voice recognition is not supported in this browser.',
    error: 'Sorry, I could not understand. Please try again.',
    navDescription:
      'Navigate mode. Obstacle detection, scene descriptions, sign reading and waste identification.',
    readDescription:
      'Read mode. Scan documents, understand bills and ask questions about your documents.',
  },

  'hi-IN': {
    ready: 'साथी तैयार है। नेविगेट या रीड मोड चुनें।',
    navigate: 'नेविगेट मोड चुना गया।',
    read: 'रीड मोड चुना गया।',
    home: 'होम स्क्रीन पर वापस जा रहे हैं।',
    listening: 'सुन रहा हूँ। कृपया बोलें।',
    unsupported: 'इस ब्राउज़र में वॉइस रिकग्निशन उपलब्ध नहीं है।',
    error: 'माफ़ कीजिए, मैं समझ नहीं पाया। फिर से कोशिश करें।',
    navDescription:
      'नेविगेट मोड। बाधाओं की पहचान, आसपास का विवरण, साइन पढ़ना और कचरे की पहचान।',
    readDescription:
      'रीड मोड। दस्तावेज़ स्कैन करें, बिल समझें और सवाल पूछें।',
  },

  'pa-IN': {
    ready: 'ਸਾਥੀ ਤਿਆਰ ਹੈ। ਨੈਵੀਗੇਟ ਜਾਂ ਰੀਡ ਮੋਡ ਚੁਣੋ।',
    navigate: 'ਨੈਵੀਗੇਟ ਮੋਡ ਚੁਣਿਆ ਗਿਆ।',
    read: 'ਰੀਡ ਮੋਡ ਚੁਣਿਆ ਗਿਆ।',
    home: 'ਮੁੱਖ ਸਕ੍ਰੀਨ ਤੇ ਵਾਪਸ ਜਾ ਰਹੇ ਹਾਂ।',
    listening: 'ਸੁਣ ਰਿਹਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ।',
    unsupported: 'ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਵੌਇਸ ਪਛਾਣ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।',
    error: 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਸਮਝ ਨਹੀਂ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    navDescription:
      'ਨੈਵੀਗੇਟ ਮੋਡ। ਰੁਕਾਵਟਾਂ, ਆਲੇ-ਦੁਆਲੇ ਦਾ ਵੇਰਵਾ, ਸਾਈਨ ਅਤੇ ਕੂੜੇ ਦੀ ਪਛਾਣ।',
    readDescription:
      'ਰੀਡ ਮੋਡ। ਦਸਤਾਵੇਜ਼ ਸਕੈਨ ਕਰੋ, ਬਿੱਲ ਸਮਝੋ ਅਤੇ ਸਵਾਲ ਪੁੱਛੋ।',
  },
}

const languageMessages: Record<Language, string> = {
  'en-IN': 'English selected. Saathi is ready.',
  'hi-IN': 'हिंदी भाषा चुनी गई है। साथी तैयार है।',
  'pa-IN': 'ਪੰਜਾਬੀ ਭਾਸ਼ਾ ਚੁਣੀ ਗਈ ਹੈ। ਸਾਥੀ ਤਿਆਰ ਹੈ।',
}

function App() {
  const [mode, setMode] = useState<Mode>(null)
  const [language, setLanguage] = useState<Language>('en-IN')
  const [status, setStatus] = useState('Saathi is ready')
  const [listening, setListening] = useState(false)

  const t = messages[language]

  // Load browser voices
  const getVoices = async (): Promise<SpeechSynthesisVoice[]> => {
    const synth = window.speechSynthesis

    let voices = synth.getVoices()

    if (voices.length > 0) {
      return voices
    }

    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 2000)

      synth.addEventListener(
        'voiceschanged',
        () => {
          window.clearTimeout(timeout)
          resolve()
        },
        { once: true }
      )
    })

    voices = synth.getVoices()
    return voices
  }

  // Text-to-speech function
  const speak = async (
    message: string,
    lang: Language = language
  ) => {
    const synth = window.speechSynthesis

    if (!synth) {
      console.error('Speech synthesis is not supported.')
      setStatus('Speech is not supported in this browser.')
      return
    }

    synth.cancel()

    const voices = await getVoices()

    console.log('Requested language:', lang)
    console.log(
      'Available voices:',
      voices.map((voice) => `${voice.name} (${voice.lang})`)
    )

    const languageCode = lang.split('-')[0].toLowerCase()

    const selectedVoice =
      voices.find(
        (voice) => voice.lang.toLowerCase() === lang.toLowerCase()
      ) ||
      voices.find(
        (voice) =>
          voice.lang.toLowerCase().startsWith(languageCode + '-')
      )

    const utterance = new SpeechSynthesisUtterance(message)

    utterance.lang = lang
    utterance.rate = 0.85
    utterance.pitch = 1

    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang

      console.log('Selected voice:', selectedVoice.name)
    } else {
      console.warn('No matching voice found for:', lang)
      setStatus(`No installed speech voice found for ${lang}`)
    }

    utterance.onstart = () => {
      console.log('Speech started:', lang)
    }

    utterance.onend = () => {
      console.log('Speech finished:', lang)
    }

    utterance.onerror = (event) => {
      console.error('Speech error:', event.error)
    }

    synth.speak(utterance)
  }

  // Change between Navigate and Read modes
  const selectMode = (selectedMode: Exclude<Mode, null>) => {
    setMode(selectedMode)

    const message =
      selectedMode === 'navigate' ? t.navigate : t.read

    setStatus(message)
    speak(message)

    if ('vibrate' in navigator) {
      navigator.vibrate(
        selectedMode === 'navigate' ? 100 : [100, 100, 100]
      )
    }
  }

  // Return to home screen
  const goHome = () => {
    setMode(null)
    setStatus(t.home)
    speak(t.home)
  }

  // Change application language
  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage)

    const message = languageMessages[newLanguage]

    setStatus(message)
    speak(message, newLanguage)
  }

  // Voice command recognition
  const startListening = () => {
    const browserWindow = window as any

    const SpeechRecognition =
      browserWindow.SpeechRecognition ||
      browserWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus(t.unsupported)
      speak(t.unsupported)
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setListening(true)
      setStatus(t.listening)
    }

    recognition.onresult = (event: any) => {
      const command =
        event.results[0][0].transcript.toLowerCase()

      console.log('Voice command:', command)

      if (
        command.includes('navigate') ||
        command.includes('नेविगेट') ||
        command.includes('ਨੈਵੀਗੇਟ')
      ) {
        selectMode('navigate')
      } else if (
        command.includes('read') ||
        command.includes('रीड') ||
        command.includes('ਪੜ੍ਹ')
      ) {
        selectMode('read')
      } else if (
        command.includes('home') ||
        command.includes('back') ||
        command.includes('वापस') ||
        command.includes('ਘਰ')
      ) {
        goHome()
      } else {
        setStatus(t.error)
        speak(t.error)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Recognition error:', event.error)
      setStatus(t.error)
      speak(t.error)
    }

    recognition.onend = () => {
      setListening(false)
    }

    try {
      recognition.start()
    } catch (error) {
      console.error('Recognition start error:', error)
      setListening(false)
    }
  }

  // Repeat welcome message
  const announceReady = () => {
    setStatus(t.ready)
    speak(t.ready)
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">
            S
          </div>

          <div>
            <h1>Saathi</h1>
            <p>YOUR AI COMPANION</p>
          </div>
        </div>

        <div className="language-control">
          <label htmlFor="language">Language</label>

          <select
            id="language"
            value={language}
            onChange={(event) =>
              changeLanguage(event.target.value as Language)
            }
            aria-label="Choose language"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="welcome">
        <div className="status-indicator">
          <span className="status-dot" />
          ASSISTIVE TECHNOLOGY
        </div>

        <h2>
          Your world,
          <br />
          <span>without limits.</span>
        </h2>

        <p className="welcome-description">
          A smarter companion to help you navigate your surroundings
          and understand the world around you.
        </p>
      </section>

      {!mode ? (
        <section className="mode-container" aria-label="Choose a mode">
          <button
            className="mode-card navigate-card"
            onClick={() => selectMode('navigate')}
            aria-label="Navigate mode. Activate obstacle detection and explore surroundings."
          >
            <div className="mode-icon" aria-hidden="true">
              ➤
            </div>

            <div className="mode-content">
              <span className="mode-number">01 / EXPLORE</span>

              <h2>NAVIGATE</h2>

              <p>
                Understand your surroundings, detect obstacles,
                read signs and identify waste.
              </p>

              <span className="mode-action">
                Activate Navigate <span aria-hidden="true">→</span>
              </span>
            </div>
          </button>

          <button
            className="mode-card read-card"
            onClick={() => selectMode('read')}
            aria-label="Read mode. Activate document and bill reading."
          >
            <div className="mode-icon" aria-hidden="true">
              ▤
            </div>

            <div className="mode-content">
              <span className="mode-number">02 / UNDERSTAND</span>

              <h2>READ</h2>

              <p>
                Read documents, understand bills, detect incorrect
                totals and ask questions.
              </p>

              <span className="mode-action">
                Activate Read <span aria-hidden="true">→</span>
              </span>
            </div>
          </button>
        </section>
      ) : mode === 'navigate' ? (
  <NavigateMode onBack={goHome} language={language} />
) : (
  <section className="active-mode" aria-live="polite">
    <div className="active-mode-icon">▤</div>

    <span className="mode-number">ACTIVE MODE</span>

    <h2>Read Mode</h2>

    <p>{t.readDescription}</p>

    <div className="coming-soon">
      <span className="status-dot" />
      Read mode is being developed
    </div>

    <button className="back-button" onClick={goHome}>
      ← Back to Home
    </button>
  </section>
)}

      <section className="voice-section">
        <button
          className={`voice-button ${listening ? 'is-listening' : ''}`}
          onClick={startListening}
          aria-label="Activate voice commands"
        >
          <span aria-hidden="true">
            {listening ? '◉' : '🎙'}
          </span>
        </button>

        <div className="voice-text">
          <h3>{listening ? 'Listening...' : 'Talk to Saathi'}</h3>
          <p>Say "Navigate", "Read" or "Home"</p>
        </div>

        <button
          className="repeat-button"
          onClick={announceReady}
          aria-label="Repeat welcome message"
        >
          ↻
        </button>
      </section>

      <footer className="footer">
        <div className="footer-status" role="status" aria-live="polite">
          <span className="status-dot" />
          {status}
        </div>

        <p>BUILT WITH CARE. DESIGNED FOR EVERYONE.</p>
      </footer>
    </main>
  )
}

export default App
