import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, Flame, Lightbulb, ListChecks, RotateCcw, Sparkles, X } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getDailyChallenge, learningTrackMeta } from '../../public/data'
import { TrackIcon, trackClass } from '../../public/PublicCards'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { PythonWorkbench } from '../../public/runtime/PythonWorkbench'
import { clearDailyDraft, getDailyDraft, saveDailyDraft } from '../../public/runtime/storage'
import type { StarterFile } from '../../public/types'
import type { PythonCheckResult } from '../../public/runtime/usePythonRunner'
import '../../public/runtime.css'

type ChallengeResult = { id: string; label: string; passed: boolean; message?: string }

function cloneFiles(files: StarterFile[]) {
  return files.map((file) => ({ ...file }))
}

export function DailyChallengeWorkspacePage() {
  const params = useParams()
  const track = params.track === 'python' ? 'python' : null
  const day = Number(params.day)
  const challenge = useMemo(() => track && Number.isInteger(day) ? getDailyChallenge(track, day) : undefined, [day, track])
  const progress = usePublicProgress()
  const draftOwner = progress.authSession
  const [files, setFiles] = useState<StarterFile[]>(() => challenge ? cloneFiles(getDailyDraft(draftOwner, challenge.track, challenge.day)?.files ?? challenge.starterFiles) : [])
  const [results, setResults] = useState<ChallengeResult[]>([])
  const [hintsOpen, setHintsOpen] = useState(false)
  const [justFinished, setJustFinished] = useState(false)

  useEffect(() => {
    if (!challenge) return
    document.title = `Day ${challenge.day}: ${challenge.title} — L2E LAB`
    setFiles(cloneFiles(getDailyDraft(draftOwner, challenge.track, challenge.day)?.files ?? challenge.starterFiles))
    setResults([])
    setJustFinished(false)
  }, [challenge, draftOwner])

  useEffect(() => {
    if (!challenge || !draftOwner || files.length === 0) return
    const timeout = window.setTimeout(() => saveDailyDraft(draftOwner, challenge.track, challenge.day, files), 450)
    return () => window.clearTimeout(timeout)
  }, [challenge, draftOwner, files])

  if (!track || !challenge) return <Navigate to="/daily" replace />

  const activeTrack = track
  const activeChallenge = challenge
  const finished = progress.isChallengeFinished(activeTrack, day)
  const checksPassed = results.length > 0 && results.every((item) => item.passed)
  const mainPythonFile = files.find((file) => file.language === 'python') ?? files[0]
  const previousDay = day > 1 ? day - 1 : null
  const nextDay = day < 100 ? day + 1 : null

  function updatePython(code: string) {
    setFiles((current) => current.map((file) => file.path === mainPythonFile.path ? { ...file, code } : file))
  }

  function completeChallenge(next: ChallengeResult[]) {
    if (!next.length || !next.every((item) => item.passed)) return
    if (!progress.isChallengeFinished(activeTrack, day)) {
      progress.finishChallenge(activeTrack, day)
      setJustFinished(true)
    }
  }

  function handlePythonChecks(passed: boolean, next: PythonCheckResult[]) {
    setResults(next)
    if (passed) completeChallenge(next)
  }

  function resetChallenge() {
    if (!window.confirm('Reset this day to its starter code? Your current draft will be replaced.')) return
    if (draftOwner) clearDailyDraft(draftOwner, activeTrack, day)
    setFiles(cloneFiles(activeChallenge.starterFiles))
    setResults([])
  }

  return (
    <div className="runtime-page ide-page daily-workspace-page">
      <header className="ide-toolbar daily-workspace-top">
        <div className="daily-workspace-top__inner">
          <Link to="/daily/python"><ArrowLeft size={15} /> Exit challenge</Link>
          <div className="daily-day-switcher">
            {previousDay ? <Link aria-label={`Previous challenge, day ${previousDay}`} to={`/daily/${track}/${previousDay}`}><ArrowLeft size={15} /></Link> : <span />}
            <strong>Day {day} of 100</strong>
            {nextDay ? <Link aria-label={`Next challenge, day ${nextDay}`} to={`/daily/${track}/${nextDay}`}><ArrowRight size={15} /></Link> : <span />}
          </div>
          <div className="daily-workspace-actions">
            <span className="draft-saved"><Check size={13} /> Saved locally</span>
            <button type="button" className="runtime-reset" onClick={resetChallenge}><RotateCcw size={14} /> Reset</button>
            {finished && <span className="finished-chip"><CheckCircle2 size={15} /> Completed</span>}
          </div>
        </div>
      </header>

      {justFinished && (
        <div className="daily-celebration">
          <div><span><Sparkles size={18} /></span><p><strong>Day {day} complete!</strong> Your account progress will sync automatically.</p>{nextDay && <Link to={`/daily/${track}/${nextDay}`}>Go to day {nextDay} <ArrowRight size={14} /></Link>}<button onClick={() => setJustFinished(false)} aria-label="Dismiss"><X size={15} /></button></div>
        </div>
      )}

      <div className="ide-workspace-grid daily-workspace-grid">
        <aside className="ide-task-panel daily-brief" aria-label="Challenge instructions">
          <div className="daily-brief__day"><span className={trackClass[track]}><TrackIcon track={track} size={18} /></span><div><small>{learningTrackMeta[track].label} · Day {day}</small><strong>{challenge.concept}</strong></div><Flame size={18} /></div>
          <span className="runtime-kicker"><Sparkles size={13} /> Today&apos;s build</span>
          <h1>{challenge.title}</h1>
          <p className="daily-summary">{challenge.summary}</p>
          <div className="daily-time"><Clock3 size={14} /> About {challenge.estimatedMinutes} minutes <i /> {challenge.difficulty}</div>

          <section className="daily-prompt"><strong>Your challenge</strong><p>{challenge.prompt}</p></section>

          <section className="daily-instructions">
            <strong>What your solution must do</strong>
            <ol>{challenge.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
          </section>

          <section className="daily-examples">
            <strong>Example input and expected output</strong>
            {challenge.examples.map((example) => (
              <article key={`${example.label}-${example.input}`}>
                <span>{example.label}</span>
                <div><small>INPUT</small><code>{example.input}</code></div>
                <div><small>EXPECTED OUTPUT</small><code>{example.expectedOutput}</code></div>
                {example.explanation && <p>{example.explanation}</p>}
              </article>
            ))}
          </section>

          <section className="daily-expected"><CheckCircle2 size={17} /><div><strong>Completion target</strong><p>{challenge.expectedOutcome}</p></div></section>

          <section className="daily-check-list">
            <header><ListChecks size={16} /><strong>Automated checks</strong><span>{results.filter((item) => item.passed).length}/{challenge.validation.length}</span></header>
            {challenge.validation.map((rule) => {
              const result = results.find((item) => item.id === rule.id)
              return <div key={rule.id} className={result?.passed ? 'is-passed' : result ? 'is-failed' : ''}><span>{result?.passed ? <Check size={13} /> : result ? <X size={13} /> : null}</span><p>{rule.label}</p></div>
            })}
            {checksPassed && <p className="daily-ready"><CheckCircle2 size={14} /> All checks pass. This day is now completed!</p>}
          </section>

          <section className="project-hints daily-hints">
            <button type="button" onClick={() => setHintsOpen((current) => !current)}><span><Lightbulb size={16} /> Show hints</span><ChevronDown size={16} /></button>
            {hintsOpen && <ol>{challenge.hints.map((hint) => <li key={hint}>{hint}</li>)}</ol>}
          </section>
        </aside>

        <main className="ide-code-panel daily-runtime" aria-label="Python editor and results">
          <PythonWorkbench code={mainPythonFile.code} onChange={updatePython} validation={challenge.validation} onCheckComplete={handlePythonChecks} filename="challenge.py" height={690} />
        </main>
      </div>
    </div>
  )
}
