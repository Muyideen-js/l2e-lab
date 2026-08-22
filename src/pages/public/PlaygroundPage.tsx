import { useEffect, useState } from 'react'
import { ArrowLeft, Braces, CheckCircle2, Code2, Info, Lightbulb, LockKeyhole, RotateCcw, TerminalSquare, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { PythonWorkbench } from '../../public/runtime/PythonWorkbench'
import { clearPlaygroundDraft, getPlaygroundDraft, savePlaygroundDraft } from '../../public/runtime/storage'
import '../../public/runtime.css'
import '../../public/course-playground.css'

const pythonStarter = `name = "Yaomin"
message = "Welcome to L2E LAB, " + name + "!"

print(message)`

const trackTabs = [
  { id: 'python', label: 'Python', detail: 'Python 3', icon: TerminalSquare, locked: false },
  { id: 'react', label: 'React', detail: 'Locked', icon: Code2, locked: true },
  { id: 'javascript', label: 'JavaScript', detail: 'Locked', icon: Braces, locked: true },
]

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  }))

  useEffect(() => {
    const update = () => setSize({ height: window.innerHeight, width: window.innerWidth })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return size
}

export function PlaygroundPage() {
  const { authSession: draftOwner } = usePublicProgress()
  const [pythonCode, setPythonCode] = useState(() => getPlaygroundDraft(draftOwner)?.code ?? pythonStarter)
  const [showInfo, setShowInfo] = useState(false)
  const viewport = useViewportSize()

  useEffect(() => { document.title = 'Code Playground — L2E LAB' }, [])

  useEffect(() => {
    setPythonCode(getPlaygroundDraft(draftOwner)?.code ?? pythonStarter)
  }, [draftOwner])

  useEffect(() => {
    if (!draftOwner) return
    const timeout = window.setTimeout(() => savePlaygroundDraft(draftOwner, pythonCode), 450)
    return () => window.clearTimeout(timeout)
  }, [draftOwner, pythonCode])

  const mobile = viewport.width <= 700
  const availablePanelHeight = Math.max(mobile ? 420 : 500, viewport.height - (mobile ? 108 : 72) - (showInfo ? 48 : 0))
  const pythonHeight = Math.max(370, availablePanelHeight - (mobile ? 78 : 49))

  function resetActive() {
    if (draftOwner) clearPlaygroundDraft(draftOwner)
    setPythonCode(pythonStarter)
  }

  return (
    <div className="cp-playground">
      <header className="cp-playground-toolbar">
        <div className="cp-playground-title">
          <Link className="cp-playground-exit" to="/" aria-label="Exit playground and return to the learning hub">
            <ArrowLeft size={16} />
          </Link>
          <Code2 size={18} />
          <div><strong>Python playground</strong><span>playground.py</span></div>
        </div>

        <div className="cp-track-tabs" role="tablist" aria-label="Choose a coding language">
          {trackTabs.map(({ id, label, detail, icon: Icon, locked }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === 'python'}
              aria-disabled={locked}
              disabled={locked}
              className={locked ? 'is-locked' : 'is-active'}
            >
              <Icon size={15} />
              <span>{label}<small>{detail}</small></span>
              {locked && <LockKeyhole className="cp-tab-lock" size={12} />}
            </button>
          ))}
        </div>

        <div className="cp-playground-actions">
          <button type="button" className={showInfo ? 'is-active' : ''} onClick={() => setShowInfo((current) => !current)} aria-label="About the playground">
            {showInfo ? <X size={15} /> : <Info size={15} />} <span>Info</span>
          </button>
          <button type="button" onClick={resetActive}><RotateCcw size={14} /> <span>Reset</span></button>
        </div>
      </header>

      {showInfo && (
        <aside className="cp-playground-info">
          <Info size={15} />
          <p><strong>No local setup required.</strong> Python runs in a private browser worker, while your completed learning progress belongs to your signed-in account. React and JavaScript are locked for now.</p>
          <button type="button" onClick={() => setShowInfo(false)} aria-label="Close information"><X size={14} /></button>
        </aside>
      )}

      <main className="cp-playground-workspace">
        <aside className="cp-playground-brief" aria-label="Playground task">
          <header><span>START HERE</span><strong>Your first Python task</strong></header>
          <div className="cp-playground-brief__body">
            <span className="cp-playground-brief__eyebrow"><TerminalSquare size={13} /> Beginner practice</span>
            <h1>Print a welcome message</h1>
            <p>Python can show words on the screen with <code>print()</code>. Run the starter code and look for the message in Output.</p>

            <section>
              <strong>Try these steps</strong>
              <ol>
                <li>Press <b>Run code</b> and read the output.</li>
                <li>Change <code>Yaomin</code> to your own name.</li>
                <li>Run it again and see what changed.</li>
              </ol>
            </section>

            <section className="cp-playground-expected">
              <CheckCircle2 size={16} />
              <div><strong>Expected output</strong><code>Welcome to L2E LAB, Yaomin!</code></div>
            </section>

            <section className="cp-playground-tip">
              <Lightbulb size={15} />
              <p><strong>New to Python?</strong> Text goes inside quotation marks. The <code>+</code> joins pieces of text together.</p>
            </section>
          </div>
          <footer><TerminalSquare size={14} /><span>playground.py</span><small>Python 3</small></footer>
        </aside>
        <div className="cp-playground-editor">
          <PythonWorkbench code={pythonCode} onChange={setPythonCode} filename="playground.py" height={pythonHeight} />
        </div>
      </main>
    </div>
  )
}
