import { useState, useRef, useCallback } from 'react'

// ── UPDATE THIS once your friend sends the HF Space URL ──
const HF_URL = "https://YOUR-FRIEND-HF-SPACE.hf.space"

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────
const SEASON_META = {
  autunno:   { label: 'Autumn',  emoji: '🍂', accent: '#9c5a1d', bg: '#fdf3e7', border: '#e8c49a', desc: 'Warm, rich, earthy undertones. Deep bronzes, burnt oranges, and olive greens define your natural palette.' },
  estate:    { label: 'Summer',  emoji: '🌸', accent: '#5e8a96', bg: '#eef4f6', border: '#a8cdd6', desc: 'Cool, soft, and muted. Dusty roses, lavender, and powdery blues reflect your delicate, low-contrast colouring.' },
  inverno:   { label: 'Winter',  emoji: '❄️', accent: '#353759', bg: '#eeeef4', border: '#9fa1c4', desc: 'Cool, high-contrast, and vivid. Icy whites, jet black, and jewel tones amplify your striking clarity.' },
  primavera: { label: 'Spring',  emoji: '🌷', accent: '#b86b38', bg: '#fef5ee', border: '#f0c09a', desc: 'Warm, bright, and clear. Coral, peach, golden yellow, and clear aqua echo your luminous, fresh quality.' },
}

const PALETTE = {
  autunno:   ['#8B4513','#D2691E','#CD853F','#6B8E23','#A0522D'],
  estate:    ['#B0A0C0','#C8A0A0','#A0B4C8','#D4B0C0','#8899AA'],
  inverno:   ['#1C1C2E','#E8E8F0','#4169E1','#DC143C','#008080'],
  primavera: ['#FF7F50','#FFD700','#90EE90','#FFA07A','#40E0D0'],
}

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Dataset Augmentation',
    body: 'Raw images were preprocessed with background masking (isolating the face region), followed by augmentation — random crops, horizontal flips, colour jitter (brightness ±0.4, contrast ±0.2, saturation ±0.2), and sharpness adjustment. This prevents the model from learning spurious background correlations and improves generalisation across lighting conditions.',
  },
  {
    step: '02',
    title: 'FaRL Face Segmentation',
    body: 'FaRL (Face Representation Learning, ViT-based) performs pixel-level semantic segmentation, partitioning the face into labelled regions: skin (label 1), eyes/iris (labels 4–5), lips (labels 7–9), eyebrows, nose, and hair. Segmentation masks are then eroded (morphological operation) to remove boundary pixels contaminated by adjacent regions — e.g. eyelid skin bleeding into the iris mask.',
    image: '/seg-example.png',
    imageCaption: 'FaRL segmentation output: each facial region isolated as a binary mask, with dominant RGB extracted per region.',
  },
  {
    step: '03',
    title: 'K-Means Colour Extraction',
    body: 'For each segmented region, K-Means clustering (k=2–6, adaptive based on pixel count) is run on the pixel RGB values. Rather than taking a simple mean — which is skewed by shadows and specular highlights — we select the largest valid cluster centroid. Validity is enforced via LAB colour space filters: L* range (25–210) excludes pure black (pupil) and pure white (sclera); A* range (110–160) rejects skin bleed into the iris. This gives a perceptually accurate dominant colour unaffected by local lighting variation.',
    image: '/kmeans-example.png',
    imageCaption: 'K-Means cluster visualisation: gold pixels = chosen cluster, grey = rejected. Swatch shows the extracted dominant colour.',
  },
]

const EXPERIMENTS = [
  {
    tag: 'Experiment A',
    title: 'Grayscale Features',
    hypothesis: 'We hypothesised that structural facial features — shape, texture, region contrast — might carry more discriminative signal than colour alone, making grayscale inputs sufficient.',
    result: 'Accuracy: 0.11 (chance level for 4 classes = 0.25)',
    outcome: 'fail',
    finding: 'Grayscale images caused the model to collapse toward chance performance, confirming that chromatic information (hue, saturation, undertone) is the primary discriminative signal for colour season classification. Shape and texture are not sufficient substitutes.',
  },
  {
    tag: 'Experiment B',
    title: 'Colour Space Comparison: RGB vs HSV vs LAB',
    hypothesis: 'Each colour space encodes chromatic information differently. RGB is device-dependent and perceptually non-uniform. HSV decouples hue from luminance. LAB is perceptually uniform — equal Euclidean distances correspond to equal perceived colour differences.',
    result: 'HSV: 0.3933 · RGB: 0.3876 · LAB: 0.3820',
    outcome: 'insight',
    finding: 'HSV marginally outperformed RGB and LAB on classification accuracy. This aligns with the intuition that hue (H channel) and saturation (S channel) are the most season-relevant dimensions, and that decoupling them from value/brightness reduces noise from lighting variation. LAB underperformed despite its perceptual uniformity — likely because the linear head in our classifier benefits from the more separable HSV encoding of warm/cool hue differences. For the final colour extraction pipeline (K-Means validity filters), LAB remained superior due to its cross-ethnicity perceptual properties.',
  },
]

// ─────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────
function UploadZone({ onImage, preview }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    onImage(file, URL.createObjectURL(file))
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      style={{
        border: `1.5px dashed ${dragging ? '#6b5c4e' : '#d4cdc5'}`,
        borderRadius: 8,
        cursor: 'pointer',
        background: dragging ? '#f5f0ea' : '#faf8f5',
        transition: 'all 0.2s',
        overflow: 'hidden',
        minHeight: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])} />
      {preview ? (
        <img src={preview} alt="preview"
          style={{ width: '100%', display: 'block', maxHeight: 440, objectFit: 'cover', borderRadius: 8 }} />
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#b0a89e' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1" style={{ marginBottom: 16, opacity: 0.6 }}>
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.2rem', marginBottom: 6, color: '#6b5c4e' }}>
            Drop your photo here
          </p>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.05em', marginBottom: 8 }}>or click to browse</p>
          <p style={{ fontSize: '0.72rem', opacity: 0.7, lineHeight: 1.5 }}>
            Best results: clear frontal face photo,<br />neutral background, even lighting
          </p>
        </div>
      )}
    </div>
  )
}

function Swatch({ hex, size = 36, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div title={hex} style={{
        width: size, height: size, borderRadius: '50%',
        background: hex || '#ccc',
        border: '3px solid #fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        margin: '0 auto',
      }} />
      {label && <p style={{ fontSize: '0.6rem', marginTop: 5, color: '#9a9189', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>}
      {hex && <p style={{ fontSize: '0.6rem', color: '#c4bdb4', marginTop: 2 }}>{hex}</p>}
    </div>
  )
}

function ConfidenceBar({ label, value, accent }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.78rem' }}>
        <span style={{ textTransform: 'capitalize', letterSpacing: '0.03em', color: '#4a4440' }}>{label}</span>
        <span style={{ color: '#9a9189', fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 4, background: '#ede8e2', borderRadius: 4 }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${value}%`, background: accent,
          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

function ResultPanel({ result }) {
  const meta = SEASON_META[result.season]
  const palette = PALETTE[result.season]

  return (
    <div style={{ animation: 'fadeUp 0.45s ease both' }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }`}</style>

      {/* Season card */}
      <div style={{
        background: meta.bg,
        borderRadius: 10,
        padding: '1.75rem 2rem',
        marginBottom: 22,
        border: `1px solid ${meta.border}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 4,
          height: '100%', background: meta.accent, borderRadius: '10px 0 0 10px'
        }} />
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: meta.accent, marginBottom: 10 }}>
          Your colour season
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2.6rem', fontWeight: 400, lineHeight: 1 }}>
            {meta.label}
          </h2>
          <span style={{ fontSize: '1.6rem' }}>{meta.emoji}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: meta.accent, marginBottom: 14, opacity: 0.8 }}>
          {result.confidence.toFixed(1)}% confidence
        </p>
        <p style={{ fontSize: '0.88rem', lineHeight: 1.65, color: '#4a4440' }}>{meta.desc}</p>
      </div>

      {/* Extracted colours */}
      {(result.colours?.skin || result.colours?.eyes || result.colours?.lips) && (
        <div style={{
          marginBottom: 22, padding: '1.25rem 1.5rem',
          background: '#faf8f5', borderRadius: 8, border: '1px solid #ede8e2'
        }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 14 }}>
            Extracted face colours
          </p>
          <div style={{ display: 'flex', gap: 24 }}>
            {result.colours.skin  && <Swatch hex={result.colours.skin}  size={52} label="Skin" />}
            {result.colours.eyes  && <Swatch hex={result.colours.eyes}  size={52} label="Eyes" />}
            {result.colours.lips  && <Swatch hex={result.colours.lips}  size={52} label="Lips" />}
          </div>
        </div>
      )}

      {/* Season palette */}
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 12 }}>
          Recommended palette
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {palette.map((hex) => (
            <div key={hex} title={hex} style={{
              width: 40, height: 40, borderRadius: 6,
              background: hex, border: '2px solid #fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }} />
          ))}
        </div>
      </div>

      {/* Confidence breakdown */}
      <div style={{ padding: '1.25rem 1.5rem', background: '#faf8f5', borderRadius: 8, border: '1px solid #ede8e2' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 14 }}>
          Model confidence — all seasons
        </p>
        {Object.entries(result.probabilities).map(([season, pct]) => (
          <ConfidenceBar key={season}
            label={SEASON_META[season]?.label || season}
            value={pct}
            accent={SEASON_META[season]?.accent || '#888'} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────
function HowItWorksSection() {
  const [open, setOpen] = useState(false)

  return (
    <section style={{ borderTop: '1px solid #e4ddd5', paddingTop: 36 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', textAlign: 'left',
      }}>
        <div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 6 }}>
            Methodology
          </p>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.9rem', fontWeight: 400, color: '#1a1612' }}>
            How it works
          </h2>
        </div>
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '1px solid #d4cdc5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', color: '#6b5c4e', flexShrink: 0,
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.25s',
        }}>+</span>
      </button>

      {open && (
        <div style={{ marginTop: 32 }}>
          {PIPELINE_STEPS.map((s, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: s.image ? '1fr 1fr' : '1fr',
              gap: 32, marginBottom: 40,
              paddingBottom: 40,
              borderBottom: i < PIPELINE_STEPS.length - 1 ? '1px solid #ede8e2' : 'none',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{
                    fontFamily: 'Cormorant Garamond', fontSize: '0.85rem',
                    color: '#b0a89e', letterSpacing: '0.08em'
                  }}>{s.step}</span>
                  <h3 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.25rem', fontWeight: 400 }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: '0.83rem', lineHeight: 1.75, color: '#4a4440' }}>{s.body}</p>
              </div>
              {s.image && (
                <div>
                  <img src={s.image} alt={s.title}
                    style={{ width: '100%', borderRadius: 8, border: '1px solid #ede8e2', display: 'block' }} />
                  <p style={{ fontSize: '0.7rem', color: '#9a9189', marginTop: 8, lineHeight: 1.5 }}>
                    {s.imageCaption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────
// EXPERIMENTS
// ─────────────────────────────────────────────
function ExperimentsSection() {
  const [open, setOpen] = useState(false)

  const tagColour = (outcome) => outcome === 'fail'
    ? { bg: '#fdf0f0', border: '#f5c0c0', text: '#b94a4a' }
    : { bg: '#f0f4fd', border: '#b8c8f0', text: '#3a5a9c' }

  return (
    <section style={{ borderTop: '1px solid #e4ddd5', paddingTop: 36 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', textAlign: 'left',
      }}>
        <div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 6 }}>
            Research
          </p>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.9rem', fontWeight: 400, color: '#1a1612' }}>
            Our experiments
          </h2>
        </div>
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '1px solid #d4cdc5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', color: '#6b5c4e', flexShrink: 0,
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.25s',
        }}>+</span>
      </button>

      {open && (
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 24 }}>
          {EXPERIMENTS.map((exp, i) => {
            const tc = tagColour(exp.outcome)
            return (
              <div key={i} style={{
                background: '#faf8f5', borderRadius: 10,
                border: '1px solid #ede8e2', overflow: 'hidden',
              }}>
                {/* Card header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #ede8e2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{
                      fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '3px 10px', borderRadius: 20,
                      background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text,
                    }}>{exp.tag}</span>
                    <span style={{
                      fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: exp.outcome === 'fail' ? '#b94a4a' : '#3a5a9c'
                    }}>{exp.outcome === 'fail' ? '✗ Negative result' : '✓ Key insight'}</span>
                  </div>
                  <h3 style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.2rem', fontWeight: 400 }}>{exp.title}</h3>
                </div>

                {/* Card body */}
                <div style={{ padding: '1.25rem 1.5rem' }}>
                  <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 6 }}>Hypothesis</p>
                  <p style={{ fontSize: '0.82rem', lineHeight: 1.7, color: '#4a4440', marginBottom: 16 }}>{exp.hypothesis}</p>

                  {/* Result pill */}
                  <div style={{
                    background: tc.bg, border: `1px solid ${tc.border}`,
                    borderRadius: 6, padding: '0.6rem 1rem', marginBottom: 16,
                    display: 'inline-block',
                  }}>
                    <p style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: tc.text, marginBottom: 2 }}>Result</p>
                    <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1rem', color: tc.text, fontWeight: 500 }}>{exp.result}</p>
                  </div>

                  <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a9189', marginBottom: 6 }}>Finding</p>
                  <p style={{ fontSize: '0.82rem', lineHeight: 1.7, color: '#4a4440' }}>{exp.finding}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleImage = (f, url) => {
    setFile(f); setPreview(url); setResult(null); setError(null)
  }

  const analyse = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)

    try {
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

      if (!response.ok) throw new Error(`Server error ${response.status}`)
      const json = await response.json()
      setResult(json.data?.[0] ?? json)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '3.5rem 2rem' }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: '3.5rem' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b0a89e', marginBottom: 10 }}>
          Colour Analysis · Machine Learning Project
        </p>
        <h1 style={{
          fontFamily: 'Cormorant Garamond',
          fontSize: 'clamp(2.6rem, 5vw, 4.2rem)',
          fontWeight: 300, lineHeight: 1.05, color: '#1a1612',
        }}>
          Discover your <em>colour season</em>
        </h1>
        <p style={{ marginTop: 14, fontSize: '0.88rem', color: '#7a7268', maxWidth: 520, lineHeight: 1.7 }}>
          Upload a frontal face photo. Our model uses FaRL face segmentation and a fine-tuned CLIP classifier to identify your seasonal colour type.
        </p>
      </header>

      {/* ── Main two-column layout ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        gap: '3rem', alignItems: 'start',
        marginBottom: '4rem',
      }}>

        {/* Left — upload */}
        <div>
          <UploadZone onImage={handleImage} preview={preview} />
          {file && (
            <button
              onClick={analyse}
              disabled={loading}
              style={{
                marginTop: 14, width: '100%', padding: '0.95rem',
                background: loading ? '#c4bdb4' : '#1a1612',
                color: '#f7f4ef', border: 'none', borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans', fontSize: '0.8rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Analysing…' : 'Analyse my colours'}
            </button>
          )}
          {error && (
            <div style={{
              marginTop: 12, padding: '0.75rem 1rem',
              background: '#fdf0f0', border: '1px solid #f5c0c0',
              borderRadius: 6, fontSize: '0.8rem', color: '#b94a4a', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Right — result */}
        <div>
          {!result && !loading && (
            <div style={{
              paddingTop: '3.5rem', textAlign: 'center', color: '#c4bdb4',
              border: '1px dashed #e4ddd5', borderRadius: 8, padding: '4rem 2rem',
            }}>
              <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.4rem', fontWeight: 300, marginBottom: 8 }}>
                Your season will appear here
              </p>
              <p style={{ fontSize: '0.78rem' }}>Upload a photo and click Analyse</p>
            </div>
          )}
          {loading && (
            <div style={{
              textAlign: 'center', padding: '4rem 2rem',
              border: '1px dashed #e4ddd5', borderRadius: 8, color: '#9a9189',
            }}>
              <div style={{
                width: 32, height: 32, border: '2px solid #e4ddd5',
                borderTopColor: '#6b5c4e', borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <p style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.3rem' }}>Reading your colours…</p>
              <p style={{ fontSize: '0.75rem', marginTop: 6 }}>10–20 seconds on first run while the model loads</p>
            </div>
          )}
          {result && <ResultPanel result={result} />}
        </div>
      </div>

      {/* ── Bottom sections ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <HowItWorksSection />
        <ExperimentsSection />
      </div>

      {/* ── Footer ── */}
      <footer style={{
        marginTop: 64, paddingTop: 24,
        borderTop: '1px solid #e4ddd5',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        fontSize: '0.72rem', color: '#c4bdb4',
      }}>
        <span>Colour Season Analysis — ML Project</span>
        <span>FaRL · CLIP ViT-B/16 · K-Means · PyTorch</span>
      </footer>
    </div>
  )
}
