
import CameraView from '../components/CameraView'

type Language = 'en-IN' | 'hi-IN' | 'pa-IN'

interface NavigateModeProps {
  onBack: () => void
  language: Language
}

function NavigateMode({ onBack, language }: NavigateModeProps) {
  return (
    <section className="active-mode navigate-screen">
      <div className="active-mode-icon">➤</div>

      <span className="mode-number">01 / EXPLORE</span>

      <h2>Navigate Mode</h2>

      <p>
        Start your camera to view your surroundings.
        AI obstacle detection is active.
      </p>

      <CameraView language={language} />

      <div className="navigation-features">
        <div>
          <span>01</span>
          <p>Obstacle Detection</p>
          <small>COCO-SSD AI model</small>
        </div>

        <div>
          <span>02</span>
          <p>Scene Description</p>
          <small>Coming next</small>
        </div>

        <div>
          <span>03</span>
          <p>Sign and Waste Recognition</p>
          <small>Coming next</small>
        </div>
      </div>

      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        ← Back to Home
      </button>
    </section>
  )
}

export default NavigateMode
