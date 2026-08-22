import type { ElementType } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Flame,
  FolderKanban,
  LockKeyhole,
  Play,
  TerminalSquare,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { isTrackAvailable } from '../../public/availability'
import { featuredProjects, publicProjects } from '../../public/data'
import { ProjectArtwork, TrackIcon, trackClass, trackName } from '../../public/PublicCards'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { hasProjectDraft } from '../../public/runtime/storage'

type LaunchCardProps = {
  className: string
  eyebrow: string
  title: string
  description: string
  meta: string
  action: string
  to: string
  icon: ElementType
}

function LaunchCard({ className, eyebrow, title, description, meta, action, to, icon: Icon }: LaunchCardProps) {
  return (
    <article className={`hub-launch-card ${className}`}>
      <header>
        <span className="hub-launch-card__icon"><Icon size={20} /></span>
        <span className="hub-launch-card__eyebrow">{eyebrow}</span>
      </header>
      <h2>{title}</h2>
      <p>{description}</p>
      <footer>
        <span>{meta}</span>
        <Link to={to}>{action} <ArrowRight size={15} /></Link>
      </footer>
    </article>
  )
}

export function PublicHomePage() {
  const {
    authSession,
    dailyProgress,
    finishedProjectIds,
    showcaseItems,
    isProjectFinished,
  } = usePublicProgress()

  const projects = featuredProjects.slice(0, 6)
  const availableProjectCount = publicProjects.filter((project) => isTrackAvailable(project.track)).length
  const completedChallenges = dailyProgress.python.length
  const localBuilds = showcaseItems.filter((item) => item.source === 'local').length

  return (
    <div className="hub-home">
      <div className="pl-container hub-home__inner">
        <header className="hub-page-head">
          <div>
            <span>LEARNING HUB</span>
            <h1>Choose what to practise.</h1>
            <p>Open a course, start a project, or test an idea in the playground.</p>
          </div>
          <div className="hub-page-head__actions">
            <Link className="pl-button pl-button--secondary" to="/my-learning">
              <Trophy size={16} /> My progress
            </Link>
            <Link className="pl-button pl-button--primary" to="/playground">
              <Play size={15} fill="currentColor" /> Open playground
            </Link>
          </div>
        </header>

        <section className="hub-launch" aria-labelledby="start-building-title">
          <div className="hub-section-bar">
            <div>
              <span className="hub-section-bar__index">01</span>
              <h2 id="start-building-title">Start building</h2>
            </div>
            <span>Pick any activity</span>
          </div>
          <div className="hub-launch-grid">
            <LaunchCard
              className="hub-launch-card--daily"
              eyebrow="DAILY COURSE"
              title="100 Days of Code"
              description="Choose a language course, open any day, and solve one focused challenge."
              meta="Python available now"
              action="Choose a course"
              to="/daily"
              icon={Flame}
            />
            <LaunchCard
              className="hub-launch-card--projects"
              eyebrow="PROJECT BUILDS"
              title="Build something real"
              description="Work from a practical brief, run your code, pass the checks, and submit your build."
              meta={`${availableProjectCount} Python projects open`}
              action="Browse projects"
              to="/projects"
              icon={FolderKanban}
            />
            <LaunchCard
              className="hub-launch-card--playground"
              eyebrow="FREE PLAY"
              title="Blank code playground"
              description="Write and run Python instantly without starting an assessment."
              meta="Python workspace"
              action="Start coding"
              to="/playground"
              icon={Code2}
            />
          </div>
        </section>

        <div className="hub-content-grid">
          <section className="hub-projects" aria-labelledby="project-builds-title">
            <div className="hub-section-bar">
              <div>
                <span className="hub-section-bar__index">02</span>
                <h2 id="project-builds-title">Project builds</h2>
              </div>
              <Link to="/projects">See all projects <ArrowRight size={14} /></Link>
            </div>

            <div className="hub-project-grid">
              {projects.map((project) => {
                const finished = isProjectFinished(project.id)
                const inProgress = !finished && hasProjectDraft(authSession, project.id)
                const action = finished ? 'Build again' : inProgress ? 'Continue build' : 'Start project'
                const available = isTrackAvailable(project.track)

                return (
                  <article className={`hub-project-card${available ? '' : ' is-locked'}`} key={project.id}>
                    <Link className="hub-project-card__art" to={`/projects/${project.slug}`} aria-label={`Open ${project.title}`}>
                      <ProjectArtwork project={project} compact />
                    </Link>
                    <div className="hub-project-card__body">
                      <div className="hub-project-card__meta">
                        <span className={`pl-track ${trackClass[project.track]}`}>
                          <TrackIcon track={project.track} /> {trackName[project.track]}
                        </span>
                        {!available ? (
                          <span className="pl-state pl-state--locked"><LockKeyhole size={12} /> Coming soon</span>
                        ) : finished ? (
                          <span className="pl-state pl-state--finished"><CheckCircle2 size={12} /> Finished</span>
                        ) : inProgress ? (
                          <span className="pl-state pl-state--progress"><Clock3 size={12} /> In progress</span>
                        ) : (
                          <span>{project.difficulty}</span>
                        )}
                      </div>
                      <h3><Link to={`/projects/${project.slug}`}>{project.title}</Link></h3>
                      <p>{project.summary}</p>
                      <div className="hub-project-card__foot">
                        <span><Clock3 size={13} /> {project.durationMinutes} min</span>
                        {available ? (
                          <Link to={`/projects/${project.slug}/build`}>{action} <ArrowRight size={14} /></Link>
                        ) : (
                          <span className="hub-project-lock"><LockKeyhole size={13} /> Locked</span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="hub-side">
            <section className="hub-panel hub-progress-panel">
              <div className="hub-panel__head">
                <div><Trophy size={17} /><h2>Your progress</h2></div>
                <Link to="/my-learning">Open <ChevronRight size={14} /></Link>
              </div>
              <div className="hub-progress-stats">
                <div><strong>{completedChallenges}</strong><span>Python days</span></div>
                <div><strong>{finishedProjectIds.length}</strong><span>Projects done</span></div>
                <div><strong>{localBuilds}</strong><span>Builds shared</span></div>
              </div>
              <div className="hub-progress-bar">
                <div><span>100 Days of Python</span><b>{completedChallenges}/100</b></div>
                <progress max="100" value={completedChallenges}>{completedChallenges}%</progress>
              </div>
              <Link className="hub-panel-button" to="/daily/python">
                <BookOpen size={15} /> Continue daily course <ArrowRight size={14} />
              </Link>
            </section>

            <section className="hub-panel hub-courses-panel">
              <div className="hub-panel__head">
                <div><TerminalSquare size={17} /><h2>Daily courses</h2></div>
                <Link to="/daily">View all <ChevronRight size={14} /></Link>
              </div>
              <Link className="hub-course-row hub-course-row--open" to="/daily/python">
                <span className="hub-course-row__code">PY</span>
                <div><strong>100 Days of Python</strong><small>All days unlocked</small></div>
                <span className="hub-course-row__status"><Check size={13} /> Open</span>
              </Link>
              <div className="hub-course-row is-locked">
                <span className="hub-course-row__code">RX</span>
                <div><strong>100 Days of React</strong><small>Coming next</small></div>
                <LockKeyhole size={14} />
              </div>
              <div className="hub-course-row is-locked">
                <span className="hub-course-row__code">JS</span>
                <div><strong>100 Days of JavaScript</strong><small>Coming next</small></div>
                <LockKeyhole size={14} />
              </div>
            </section>

            <section className="hub-panel hub-community-panel">
              <div className="hub-panel__head">
                <div><UsersRound size={17} /><h2>Community builds</h2></div>
                <Link to="/community">Explore <ChevronRight size={14} /></Link>
              </div>
              <div className="hub-community-list">
                {showcaseItems.slice(0, 3).map((item) => (
                  <Link to={`/community/${item.id}`} key={item.id}>
                    <span>{item.authorInitials}</span>
                    <div><strong>{item.title}</strong><small>{item.author} · {trackName[item.track]}</small></div>
                    <ChevronRight size={14} />
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
