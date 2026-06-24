import { useState, useRef, useCallback } from 'react'

// ── UPDATE THIS once your friend sends the HF Space URL ──
const HF_URL = "https://huggingface.co/smubiainfrastructure"

const SEASON_META = {
  autunno:  { label: 'Autumn',  emoji: '🍂', accent: '#b5651d', bg: '#fdf3e7', desc: 'Warm, rich, earthy. You carry the depth of golden forests — burnt oranges, deep browns, mossy greens.' },
  estate:   { label: 'Summer',  emoji: '🌸', accent: '#7b9ea6', bg: '#eef4f6', desc: 'Cool, soft, muted. Your palette mirrors dusk light — dusty roses, lavender haze, powdery blues.' },
  inverno:  { label: 'Winter',  emoji: '❄️', accent: '#3d3f5c', bg: '#eeeef3', desc: 'Cool, high contrast, vivid. Dramatic clarity defines you — icy whites, jet blacks, jewel tones.' },
  primavera:{ label: 'Spring',  emoji: '🌷', accent: '#c97d4e', bg: '#fef5ee', desc: 'Warm, clear, bright. Fresh and luminous — coral, peach, golden yellow, clear aqua.' },
}

const PALETTE = {
  autunno:   ['#8B4513','#D2691E','#CD853F','#6B8E23','#A0522D'],
  estate:    ['#B0A0C0','#C8A0A0','#A0B4C8','#D4B0C0','#8899AA'],
  inverno:   ['#1C1C2E','#E8E8F0','#4169E1','#DC143C','#008080'],
  primavera: ['#FF7F50','#FFD700','#90EE90','#FFA07A','#40E0D0'],
}

const HOW_IT_WORKS = [
  {
    title: 'Face Segmentation',
    body: 'FaRL (Face Representation Learning) segments your photo pixel-by-pixel into regions — skin, eyes, lips — using a transformer trained on millions of faces.',
  },
  {
    title: 'Colour Extraction',
    body: 'K-Means clustering groups pixels in each region into colour clusters. We pick the dominant cluster using LAB colour space validity filters, which handle all skin tones fairly.',
  },
  {
    title: 'RGB vs HSV vs LAB',
    body: 'RGB is raw pixel data. HSV separates hue from brightness. LAB is perceptually uniform — equal numerical distances feel equally different to the human eye. We found LAB most reliable for cross-ethnicity analysis.',
  },
  {
    title: 'Classification (FaRL + CLIP)',
    body: 'A CLIP ViT-B/16 backbone — pretrained on 400M image-text pairs and fine-tuned for faces via FaRL — extracts a 512-dim feature vector. A linear head maps this to your colour season.',
  },
  {
    title: 'The Four Seasons',
    body: 'Seasonal colour analysis groups people by undertone (warm/cool) and contrast (deep/light): Autumn (warm, muted), Summer (cool, soft), Winter (cool, vivid), Spring (warm, bright).',
  },
]

function UploadZone({ onImage, preview }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    onImage(file, url)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        border: `1.5px dashed ${dragging ? '#1a1612' : '#c4bdb4'}`,
        borderRadius: 4,
        cursor: 'pointer',
        background: dragging ? '#f0ede8' : 'transparent',
        transition: 'all 0.2s',
        overflow: 'hidden',
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {preview ? (
        <img src={preview} alt="preview" style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'cover' }} />
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#9a9189' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>↑</div>
          <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.25rem', marginBottom: 6 }}>Drop your photo here</p>
          <p style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>or click to browse — JPG, PNG, WEBP</p>
          <p style={{ fontSize: '0.75rem', marginTop: 12, opacity: 0.7 }}>Use a clear frontal face photo for best results</p>
        </div>
      )}
    </div>
  )
}

function Swatch({ hex, size = 36 }) {
  return (
    <div title={hex} style={{
      width: size, height: size,
      borderRadius: '50%',
      background: hex || '#ccc',
      border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      flexShrink: 0,
    }} />
  )
}

function ConfidenceBar({ label, value, accent }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.78rem' }}>
        <span style={{ textTransform: 'capitalize', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ color: '#9a9189' }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 3, background: '#e8e3db', borderRadius: 2 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${value}%`,
          background: accent,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

function ResultPanel({ result }) {
  const meta = SEASON_META[result.season]
  const palette = PALETTE[result.season]

  return (
    <div style={{ animation: 'fadeUp 0.5s ease both' }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }`}</style>

      {/* Season header */}
      <div style={{
        background: meta.bg,
        borderRadius: 4,
        padding: '2rem',
        marginBottom: 20,
        borderLeft: `3px solid ${meta.accent}`,
      }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: meta.accent, marginBottom: 8 }}>Your season</p>
        <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2.8rem', fontWeight: 300, lineHeight: 1, marginBottom: 4 }}>
          {meta.emoji} {meta.label}
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#9a9189', marginBottom: 16 }}>
          {result.confidence.toFixed(1)}% confidence
        </p>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#4a4440' }}>{meta.desc}</p>
      </div>

      {/* Extracted face colours */}
      {(result.colours?.skin || result.colours?.eyes || result.colours?.lips) && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 12 }}>Your extracted colours</p>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {result.colours.skin && (
              <div style={{ textAlign: 'center' }}>
                <Swatch hex={result.colours.skin} size={48} />
                <p style={{ fontSize: '0.65rem', marginTop: 6, color: '#9a9189', letterSpacing: '0.06em' }}>SKIN</p>
                <p style={{ fontSize: '0.65rem', color: '#c4bdb4' }}>{result.colours.skin}</p>
              </div>
            )}
            {result.colours.eyes && (
              <div style={{ textAlign: 'center' }}>
                <Swatch hex={result.colours.eyes} size={48} />
                <p style={{ fontSize: '0.65rem', marginTop: 6, color: '#9a9189', letterSpacing: '0.06em' }}>EYES</p>
                <p style={{ fontSize: '0.65rem', color: '#c4bdb4' }}>{result.colours.eyes}</p>
              </div>
            )}
            {result.colours.lips && (
              <div style={{ textAlign: 'center' }}>
                <Swatch hex={result.colours.lips} size={48} />
                <p style={{ fontSize: '0.65rem', marginTop: 6, color: '#9a9189', letterSpacing: '0.06em' }}>LIPS</p>
                <p style={{ fontSize: '0.65rem', color: '#c4bdb4' }}>{result.colours.lips}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Season palette */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 12 }}>Your colour palette</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {palette.map((hex) => <Swatch key={hex} hex={hex} size={40} />)}
        </div>
      </div>

      {/* Confidence breakdown */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 12 }}>All seasons</p>
        {Object.entries(result.probabilities).map(([season, pct]) => (
          <ConfidenceBar key={season} label={SEASON_META[season]?.label || season} value={pct} accent={SEASON_META[season]?.accent || '#888'} />
        ))}
      </div>
    </div>
  )
}

function HowItWorks() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderTop: '1px solid #e8e3db', marginTop: 40, paddingTop: 32 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Cormorant Garamond', fontSize: '1.4rem', fontWeight: 300,
          color: '#1a1612', width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1 }}>How it works</span>
        <span style={{ fontSize: '1rem', transition: 'transform 0.3s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>

      {open && (
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {HOW_IT_WORKS.map((item, i) => (
            <div key={i} style={{ padding: '1.25rem', background: '#f0ede8', borderRadius: 4 }}>
              <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.05rem', marginBottom: 8 }}>{item.title}</p>
              <p style={{ fontSize: '0.82rem', lineHeight: 1.65, color: '#4a4440' }}>{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleImage = (f, url) => {
    setFile(f)
    setPreview(url)
    setResult(null)
    setError(null)
  }

  const analyse = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Convert image to base64 for Gradio API
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const response = await fetch(`${HF_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [base64] }),
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)

      const json = await response.json()
      // Gradio wraps the output in data[0]
      const data = json.data?.[0] ?? json
      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem' }}>

      {/* Header */}
      <header style={{ marginBottom: '3rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 8 }}>
          Colour Analysis · ML Project
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', fontWeight: 300, lineHeight: 1.1 }}>
          Discover your<br /><em>colour season</em>
        </h1>
      </header>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '2.5rem', alignItems: 'start' }}>

        {/* Left — upload */}
        <div>
          <UploadZone onImage={handleImage} preview={preview} />
          {file && (
            <button
              onClick={analyse}
              disabled={loading}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '0.9rem',
                background: loading ? '#c4bdb4' : '#1a1612',
                color: '#f7f4ef',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans',
                fontSize: '0.85rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Analysing…' : 'Analyse my colours'}
            </button>
          )}
          {error && (
            <p style={{ marginTop: 12, color: '#c0392b', fontSize: '0.82rem', lineHeight: 1.5 }}>
              {error}
            </p>
          )}
        </div>

        {/* Right — result */}
        <div>
          {!result && !loading && (
            <div style={{ color: '#c4bdb4', paddingTop: '4rem', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.5rem', fontWeight: 300 }}>
                Your season will appear here
              </p>
              <p style={{ fontSize: '0.8rem', marginTop: 8 }}>Upload a clear frontal photo to begin</p>
            </div>
          )}
          {loading && (
            <div style={{ color: '#9a9189', paddingTop: '4rem', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.5rem', fontWeight: 300 }}>Reading your colours…</p>
              <p style={{ fontSize: '0.78rem', marginTop: 8 }}>This takes 10–20 seconds on first run</p>
            </div>
          )}
          {result && <ResultPanel result={result} />}
        </div>
      </div>

      {/* How it works */}
      <HowItWorks />

      {/* Footer */}
      <footer style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid #e8e3db', fontSize: '0.75rem', color: '#c4bdb4', display: 'flex', justifyContent: 'space-between' }}>
        <span>Colour Season Analysis — ML Project</span>
        <span>FaRL · CLIP ViT-B/16 · K-Means</span>
      </footer>
    </div>
  )
}
