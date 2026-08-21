import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Modal } from '../../components/UI'
import { getProjectBySlug, learningTrackMeta } from '../../public/data'
import { TrackIcon, trackClass } from '../../public/PublicCards'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { PythonWorkbench } from '../../public/runtime/PythonWorkbench'
import { clearProjectDraft, getProjectDraft, saveProjectDraft } from '../../public/runtime/storage'
import type { StarterFile } from '../../public/types'
import type { PythonCheckResult } from '../../public/runtime/usePythonRunner'
import '../../public/runtime.css'

type RequirementResult = { id: string; label: string; passed: boolean; message?: string }

function cloneFiles(files: StarterFile[]) {
  return files.map((file) => ({ ...file }))
}

export function ProjectBuildPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const project = useMemo(() => getProjectBySlug(slug), [slug])
  const progress = usePublicProgress()
  const draftOwner = progress.authSession
  const [files, setFiles] = useState<StarterFile[]>(() => project ? cloneFiles(getProjectDraft(draftOwner, project.id)?.files ?? project.starterFiles) : [])
  const [results, setResults] = useState<RequirementResult[]>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [submissionTitle, setSubmissionTitle] = useState(project?.title ?? '')
  const [submissionDescription, setSubmissionDescription] = useState('')

  useEffect(() => {
    if (!project) return
    document.title = `${project.title} — Build in L2E LAB`
    setFiles(cloneFiles(getProjectDraft(draftOwner, project.id)?.files ?? project.starterFiles))
    setSubmissionTitle(project.title)
    setResults([])
  }, [draftOwner, project])

  useEffect(() => {
    if (!draftOwner || !project || files.length === 0) return
    const timeout = window.setTimeout(() => saveProjectDraft(draftOwner, project.id, files), 450)
    return () => window.clearTimeout(timeout)
  }, [draftOwner, files, project])

  if (!project || project.track !== 'python') return <Navigate to={project ? `/projects/${project.slug}` : '/projects'} replace />

  const activeProject = project
  const finished = progress.isProjectFinished(activeProject.id)
  const allPassed = results.length > 0 && results.every((item) => item.passed)
  const mainPythonFile = files.find((file) => file.language === 'python') ?? files[0]

  function updatePython(code: string) {
    setFiles((current) => current.map((file) => file.path === mainPythonFile.path ? { ...file, code } : file))
  }

  function handlePythonChecks(passed: boolean, next: PythonCheckResult[]) {
    setResults(next)
    if (passed) {
      setShowHints(false)
      if (!progress.isProjectFinished(activeProject.id)) {
        progress.markProjectFinished(activeProject.id)
        setJustCompleted(true)
      }
    }
  }

  function resetStarter() {
    if (!window.confirm('Reset this project to the starter code? Your current draft will be replaced.')) return
    if (draftOwner) clearProjectDraft(draftOwner, activeProject.id)
    setFiles(cloneFiles(activeProject.starterFiles))
    setResults([])
  }

  function publishProject() {
    const item = progress.submitProject({
      project: activeProject,
      files,
      title: submissionTitle.trim() || activeProject.title,
      description: submissionDescription.trim() || `My take on ${activeProject.title}, built in L2E LAB.`,
      author: progress.displayName,
    })
    setPublishOpen(false)
    navigate(`/community?published=${item.id}`)
  }

  return (
    <div className="runtime-page ide-page project-build-page">
      <header className="ide-toolbar project-build-top">
        <div className="project-build-crumbs">
          <Link to={`/projects/${project.slug}`} aria-label="Exit workspace and return to the project"><ArrowLeft size={16} /></Link>
          <span className={`project-toolbar-track ${trackClass[project.track]}`}><TrackIcon track={project.track} size={16} /></span>
          <div><small>{learningTrackMeta[project.track].label} project</small><strong>{project.title}</strong></div>
        </div>
        <div className="project-build-status">
          <span className="draft-saved"><Check size={13} /> Draft saved on this device</span>
          {finished && <span className="finished-chip"><CheckCircle2 size={14} /> Finished</span>}
          <button type="button" className="runtime-reset" onClick={resetStarter}><RotateCcw size={14} /> Reset</button>
          <button type="button" className="pl-button pl-button--primary" onClick={() => setPublishOpen(true)}><Send size={15} /> {finished ? 'Share build' : 'Share work'}</button>
        </div>
      </header>

      {justCompleted && (
        <div className="project-complete-banner">
          <div className="pl-container"><span><Sparkles size={19} /></span><div><strong>Project finished — your checks passed!</strong><p>The Finished tag is now saved. Sharing with the community is optional.</p></div><button className="pl-button pl-button--primary" onClick={() => setPublishOpen(true)}><Send size={14} /> Share build</button><button className="icon-button" onClick={() => setJustCompleted(false)} aria-label="Dismiss"><X size={16} /></button></div>
        </div>
      )}

      <div className="ide-workspace-grid project-build-grid">
        <aside className="ide-task-panel project-brief" aria-label="Project instructions">
          <section>
            <span className="runtime-kicker"><Sparkles size={13} /> Project brief</span>
            <h1>{project.title}</h1>
            <div className="project-meta-row">
              <span>{project.difficulty}</span><span><Clock3 size={13} /> {project.durationMinutes} min</span>
            </div>
            <p className="project-summary">{project.summary}</p>
            <h2>What you&apos;re building</h2>
            <p>{project.description}</p>
            <div className="project-build-instructions">
              <strong>Build instructions</strong>
              <ol>{project.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
            </div>
            <div className="project-build-examples">
              <strong>Example input and expected output</strong>
              {project.examples.map((example) => (
                <article key={`${example.label}-${example.input}`}>
                  <span>{example.label}</span>
                  <div><small>INPUT</small><code>{example.input}</code></div>
                  <div><small>EXPECTED OUTPUT</small><code>{example.expectedOutput}</code></div>
                  {example.explanation && <p>{example.explanation}</p>}
                </article>
              ))}
            </div>
            <div className="project-outcome"><Eye size={17} /><div><strong>Expected result</strong><p>{project.expectedOutcome}</p></div></div>
          </section>

          <section className="project-requirements">
            <header><span><ListChecks size={16} /></span><div><strong>Requirements</strong><small>{results.filter((item) => item.passed).length}/{project.validation.length} checks passing</small></div></header>
            <div className="requirements-list">
              {project.requirements.map((requirement, index) => {
                const result = results[index]
                return <article key={requirement.id} className={result?.passed ? 'is-passed' : result ? 'is-failed' : ''}>
                  <span>{result?.passed ? <Check size={14} /> : result ? <X size={14} /> : index + 1}</span>
                  <div><strong>{requirement.title}</strong><p>{requirement.description}</p>{result?.message && <small>{result.message}</small>}</div>
                </article>
              })}
            </div>
            {allPassed && <div className="all-checks-passed"><CheckCircle2 size={17} /><div><strong>Ready to publish</strong><p>Every automated check passed.</p></div></div>}
          </section>

          <section className="project-hints">
            <button type="button" onClick={() => setShowHints((current) => !current)} aria-expanded={showHints}><span><Lightbulb size={16} /> Need a hint?</span><ChevronDown size={16} /></button>
            {showHints && <ol>{project.hints.map((hint) => <li key={hint}>{hint}</li>)}</ol>}
          </section>
        </aside>

        <main className="ide-code-panel project-runtime" aria-label="Python editor and results">
          <PythonWorkbench
            code={mainPythonFile.code}
            onChange={updatePython}
            validation={project.validation}
            onCheckComplete={handlePythonChecks}
            filename={mainPythonFile.path.replace(/^\//, '')}
            height={650}
          />
        </main>
      </div>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={finished ? 'Share your finished build' : 'Share work in progress'}
        eyebrow="Community showcase"
        width="md"
        footer={<><Button variant="secondary" onClick={() => setPublishOpen(false)}>Keep building</Button><Button onClick={publishProject} icon={<Send size={15} />}>Publish build</Button></>}
      >
        <div className="publish-intro">
          <span className={allPassed ? 'is-ready' : ''}>{allPassed ? <CheckCircle2 size={20} /> : <Sparkles size={20} />}</span>
          <div><strong>{allPassed ? 'All checks passed — lovely work.' : 'You can share work in progress too.'}</strong><p>Sharing adds a copy to the community showcase saved on this device. Your Finished tag comes from passing the checks.</p></div>
        </div>
        <label className="runtime-field"><span>Publishing as</span><input value={`@${progress.displayName}`} readOnly aria-readonly="true" /></label>
        <label className="runtime-field"><span>Build title</span><input value={submissionTitle} maxLength={70} onChange={(event) => setSubmissionTitle(event.target.value)} /></label>
        <label className="runtime-field"><span>Tell people what you made <small>optional</small></span><textarea value={submissionDescription} maxLength={180} onChange={(event) => setSubmissionDescription(event.target.value)} placeholder="What did you learn or add?" rows={3} /></label>
        <p className="publish-privacy">Your account owns the Finished tag. Community publishing itself is still stored only in this browser for now.</p>
      </Modal>
    </div>
  )
}
