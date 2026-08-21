import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Eye,
  Gauge,
  Lightbulb,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { isTrackAvailable } from '../../public/availability'
import { getProjectBySlug, publicProjects } from '../../public/data'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { hasProjectDraft } from '../../public/runtime/storage'
import { ProjectArtwork, PublicProjectCard, TrackIcon, trackClass, trackName } from '../../public/PublicCards'

export function PublicProjectDetailPage() {
  const { slug } = useParams()
  const project = slug ? getProjectBySlug(slug) : undefined
  const { authSession, isProjectFinished } = usePublicProgress()
  const [showHints, setShowHints] = useState(false)

  if (!project) {
    return (
      <section className="pl-container pl-not-found">
        <span><Code2 size={28} /></span>
        <h1>That project wandered off.</h1>
        <p>It may have been renamed, but there are plenty more builds waiting in the library.</p>
        <Link className="pl-button pl-button--primary" to="/projects"><ArrowLeft size={16} /> Back to projects</Link>
      </section>
    )
  }

  const finished = isProjectFinished(project.id)
  const inProgress = !finished && hasProjectDraft(authSession, project.id)
  const available = isTrackAvailable(project.track)
  const related = publicProjects.filter((item) => item.track === project.track && item.id !== project.id).slice(0, 3)

  return (
    <div className="pl-project-detail">
      <div className="pl-container">
        <nav className="pl-breadcrumb" aria-label="Breadcrumb">
          <Link to="/projects">Projects</Link><ChevronRight size={13} /><Link to={`/projects?track=${project.track}`}>{trackName[project.track]}</Link><ChevronRight size={13} /><span>{project.title}</span>
        </nav>

        <section className="pl-project-detail__hero">
          <div className="pl-project-detail__copy">
            <div className="pl-project-detail__tags">
              <span className={`pl-track ${trackClass[project.track]}`}><TrackIcon track={project.track} /> {trackName[project.track]}</span>
              {finished && <span className="pl-state pl-state--finished"><CheckCircle2 size={13} /> Finished</span>}
              {inProgress && <span className="pl-state pl-state--progress"><Clock3 size={13} /> In progress</span>}
            </div>
            <span className="pl-project-detail__kicker">{project.kicker}</span>
            <h1>{project.title}</h1>
            <p>{project.description}</p>
            <div className="pl-project-detail__meta">
              <span><Clock3 size={17} /><b>{project.durationMinutes} min</b><small>Estimated time</small></span>
              <span><Gauge size={17} /><b>{project.difficulty}</b><small>Difficulty</small></span>
              <span><Target size={17} /><b>{project.validation.length} checks</b><small>To complete</small></span>
            </div>
            <div className="pl-project-detail__actions">
              {available ? (
                <Link className="pl-button pl-button--primary pl-button--large" to={`/projects/${project.slug}/build`}>
                  {finished ? <RotateCcw size={18} /> : <Play size={18} fill="currentColor" />}
                  {finished ? 'Build it again' : inProgress ? 'Continue building' : 'Start building'}
                </Link>
              ) : (
                <span className="pl-button pl-button--locked pl-button--large" aria-disabled="true"><LockKeyhole size={18} /> Workspace coming soon</span>
              )}
              <span><LockKeyhole size={14} /> {available ? 'Sign in once, then build across devices.' : 'Python is the only active workspace for now.'}</span>
            </div>
          </div>
          <div className="pl-project-detail__visual">
            <ProjectArtwork project={project} />
            <div className="pl-project-detail__outcome"><span><Eye size={16} /></span><div><small>What you&apos;ll make</small><b>{project.expectedOutcome}</b></div></div>
          </div>
        </section>

        <section className="pl-project-detail__layout">
          <div className="pl-project-detail__content">
            <article className="pl-detail-block">
              <div className="pl-detail-block__heading"><span><Target size={19} /></span><div><small>Project brief</small><h2>Your mission</h2></div></div>
              <p className="pl-detail-block__lead">{project.summary}</p>
              <div className="pl-requirements">
                {project.requirements.map((requirement, index) => (
                  <div className="pl-requirement" key={requirement.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div><h3>{requirement.title}</h3><p>{requirement.description}</p></div>
                    <Check size={16} />
                  </div>
                ))}
              </div>
              <div className="pl-project-examples">
                <h3>Example input and expected output</h3>
                {project.examples.map((example) => (
                  <article key={`${example.label}-${example.input}`}>
                    <span>{example.label}</span>
                    <div><small>Input</small><code>{example.input}</code></div>
                    <div><small>Expected output</small><code>{example.expectedOutput}</code></div>
                  </article>
                ))}
              </div>
            </article>

            <article className="pl-detail-block">
              <div className="pl-detail-block__heading"><span><Code2 size={19} /></span><div><small>What you&apos;ll practise</small><h2>Skills in this build</h2></div></div>
              <div className="pl-skill-cloud">{project.skills.map((skill) => <span key={skill}><CheckCircle2 size={13} /> {skill}</span>)}</div>
              <div className="pl-test-preview">
                <header><div><i /><i /><i /></div><span>Project checks</span><b>{project.validation.reduce((sum, rule) => sum + rule.points, 0)} points</b></header>
                {project.validation.map((rule) => (
                  <div key={rule.id}><span><ShieldCheck size={15} /></span><p>{rule.label}</p><small>{rule.hidden ? 'Hidden check' : `${rule.points} pts`}</small></div>
                ))}
              </div>
            </article>

            <article className="pl-detail-block pl-detail-block--hints">
              <button type="button" aria-expanded={showHints} onClick={() => setShowHints((value) => !value)}>
                <span><Lightbulb size={19} /></span><div><small>Stuck is part of learning</small><h2>{showHints ? 'Hide the hints' : `Need a nudge? ${project.hints.length} hints are here.`}</h2></div><ChevronDown className={showHints ? 'is-open' : ''} size={18} />
              </button>
              {showHints && <ol>{project.hints.map((hint) => <li key={hint}>{hint}</li>)}</ol>}
            </article>
          </div>

          <aside className="pl-project-detail__aside">
            <div className="pl-start-card">
              <span className="pl-start-card__icon"><Sparkles size={21} /></span>
              <h2>{!available ? `${trackName[project.track]} builds are coming soon.` : finished ? 'You finished this one!' : inProgress ? 'Your code is waiting.' : 'Ready to make it real?'}</h2>
              <p>{!available ? 'This brief is available to explore, but its CodeSandbox workspace is locked while the Python experience is completed.' : finished ? 'Your Finished tag is synced to your learner account. Reopen the workspace whenever you want to improve it.' : inProgress ? 'Continue from the files saved in this browser.' : 'Your starter files, live runner, checks, and hints are already set up.'}</p>
              {available ? (
                <Link className="pl-button pl-button--primary" to={`/projects/${project.slug}/build`}>
                  {finished ? 'Open workspace' : inProgress ? 'Continue project' : 'Start project'} <ArrowRight size={16} />
                </Link>
              ) : (
                <span className="pl-button pl-button--locked" aria-disabled="true"><LockKeyhole size={15} /> Workspace locked</span>
              )}
              <ul><li><Check size={13} /> L2E username account</li><li><Check size={13} /> Python runs in your browser</li><li><Check size={13} /> Completion syncs in real time</li></ul>
            </div>
            <div className="pl-detail-note"><ShieldCheck size={18} /><div><b>Your code stays yours</b><p>Drafts are stored locally in this browser. Publishing creates a local showcase card until the school backend is connected.</p></div></div>
          </aside>
        </section>

        {related.length > 0 && (
          <section className="pl-related-projects">
            <div className="pl-section-heading pl-section-heading--split"><div><span className="pl-kicker"><Sparkles size={14} /> Keep building</span><h2>More in <em>{trackName[project.track]}</em></h2></div><Link className="pl-text-link" to={`/projects?track=${project.track}`}>See the whole track <ArrowRight size={16} /></Link></div>
            <div className="pl-project-grid">{related.map((item) => <PublicProjectCard project={item} finished={isProjectFinished(item.id)} key={item.id} />)}</div>
          </section>
        )}
      </div>
    </div>
  )
}
