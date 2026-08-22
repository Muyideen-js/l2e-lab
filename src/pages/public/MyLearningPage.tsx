import { useMemo } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  FolderClock,
  Heart,
  Laptop2,
  LogOut,
  Rocket,
  Sparkles,
  Trophy,
  UploadCloud,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { publicProjects } from '../../public/data'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { hasProjectDraft } from '../../public/runtime/storage'
import { PublicProjectCard, TrackIcon, trackClass, trackName } from '../../public/PublicCards'
import type { LearningTrack } from '../../public/types'

const tracks: LearningTrack[] = ['python', 'react', 'javascript']

function firstIncompleteDay(completedDays: readonly number[]): number {
  const completed = new Set(completedDays)
  for (let day = 1; day <= 100; day += 1) {
    if (!completed.has(day)) return day
  }
  return 100
}

export function MyLearningPage() {
  const {
    displayName,
    authSession,
    syncStatus,
    signOut,
    finishedProjectIds,
    dailyProgress,
    submissions,
    likedShowcaseIds,
  } = usePublicProgress()

  const finishedProjects = useMemo(() => publicProjects.filter((project) => finishedProjectIds.includes(project.id)), [finishedProjectIds])
  const inProgressProjects = useMemo(() => publicProjects.filter((project) => !finishedProjectIds.includes(project.id) && hasProjectDraft(authSession, project.id)), [authSession, finishedProjectIds])
  const completedChallenges = tracks.reduce((total, track) => total + dailyProgress[track].length, 0)
  const projectPercent = Math.round((finishedProjects.length / publicProjects.length) * 100)
  const totalActivity = finishedProjects.length + inProgressProjects.length + completedChallenges + submissions.length

  return (
    <div className="pl-learning">
      <section className="pl-learning-hero">
        <div className="pl-container pl-learning-hero__inner">
          <div className="pl-learning-profile">
            <span className="pl-learning-profile__avatar">{displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'LB'}</span>
            <div><span className="pl-kicker"><Sparkles size={14} /> Signed in as @{authSession?.username}</span><h1>Keep going, <em>{displayName}.</em></h1><p>Your projects, daily wins, and local showcase builds are all together here.</p></div>
          </div>
          <div className="pl-learning-hero__account">
            <div className="pl-learning-hero__device"><Laptop2 size={17} /><div><b>{syncStatus === 'synced' ? 'Progress synced' : syncStatus === 'syncing' ? 'Syncing progress' : syncStatus === 'offline' ? 'Saved offline' : 'Account connected'}</b><small>Your completed work follows this account</small></div></div>
            <button type="button" className="pl-learning-signout" onClick={() => { void signOut() }}><LogOut size={15} /> Sign out</button>
          </div>
        </div>
      </section>

      <section className="pl-container pl-learning__body">
        <div className="pl-learning-stats">
          <article><span className="pl-learning-stats__icon pl-learning-stats__icon--blue"><CheckCircle2 size={20} /></span><div><strong>{finishedProjects.length}</strong><p>Projects finished</p><small>{projectPercent}% of the library</small></div><i><span style={{ width: `${projectPercent}%` }} /></i></article>
          <article><span className="pl-learning-stats__icon pl-learning-stats__icon--orange"><Flame size={20} /></span><div><strong>{completedChallenges}</strong><p>Daily challenges</p><small>Across all three tracks</small></div><i><span style={{ width: `${Math.min(100, (completedChallenges / 300) * 100)}%` }} /></i></article>
          <article><span className="pl-learning-stats__icon pl-learning-stats__icon--purple"><UploadCloud size={20} /></span><div><strong>{submissions.length}</strong><p>Local publications</p><small>Visible on this device</small></div><i><span style={{ width: `${Math.min(100, submissions.length * 15)}%` }} /></i></article>
          <article><span className="pl-learning-stats__icon pl-learning-stats__icon--pink"><Heart size={20} /></span><div><strong>{likedShowcaseIds.length}</strong><p>Builds appreciated</p><small>Likes you left locally</small></div><i><span style={{ width: `${Math.min(100, likedShowcaseIds.length * 12)}%` }} /></i></article>
        </div>



        {totalActivity === 0 ? (
          <div className="pl-learning-empty">
            <div className="pl-learning-empty__art"><span><Rocket size={29} /></span><i /><i /><i /></div>
            <div><span className="pl-kicker"><Sparkles size={14} /> Fresh start</span><h2>Your first green check is waiting.</h2><p>Choose a project, run some code, or complete Day 1. Your progress will start appearing here automatically.</p><div><Link className="pl-button pl-button--primary" to="/projects">Choose a project <ArrowRight size={16} /></Link><Link className="pl-button pl-button--secondary" to="/daily">Try Day 1</Link></div></div>
          </div>
        ) : (
          <>
            {inProgressProjects.length > 0 && (
              <section className="pl-learning-section">
                <div className="pl-section-heading pl-section-heading--split"><div><span className="pl-kicker"><FolderClock size={14} /> Pick up where you left off</span><h2>In <em>progress.</em></h2><p>Your latest project drafts are stored in this browser.</p></div><Link className="pl-text-link" to="/projects">Find another project <ArrowRight size={16} /></Link></div>
                <div className="pl-project-grid">{inProgressProjects.slice(0, 3).map((project) => <PublicProjectCard project={project} inProgress linkTo={`/projects/${project.slug}/build`} key={project.id} />)}</div>
              </section>
            )}

            <section className="pl-learning-grid">
              <article className="pl-daily-progress-card">
                <header><div><span><Flame size={18} /></span><div><small>Daily 100</small><h2>Your challenge paths</h2></div></div><Link to="/daily">Open Daily 100 <ArrowRight size={15} /></Link></header>
                <div>{tracks.map((track) => {
                  const count = dailyProgress[track].length
                  const nextDay = firstIncompleteDay(dailyProgress[track])
                  const locked = track !== 'python'
                  return <div className={`pl-daily-track-row ${locked ? 'is-locked' : ''}`} key={track}>
                    <span className={`pl-track ${trackClass[track]}`}><TrackIcon track={track} /> {trackName[track]}</span>
                    <div><i><span style={{ width: `${count}%` }} /></i><small>{locked ? 'Coming soon' : `${count}/100`}</small></div>
                    {locked ? <span className="pl-track-locked">Locked</span> : <Link to={`/daily/python/${nextDay}`}>{count ? 'Continue' : 'Start'} <ArrowRight size={13} /></Link>}
                  </div>
                })}</div>
                <footer><Trophy size={15} /><span><b>{completedChallenges} complete.</b> Every small solve is evidence that you&apos;re getting better.</span></footer>
              </article>

              <article className="pl-activity-card">
                <header><div><span><Clock3 size={18} /></span><div><small>Local activity</small><h2>What you&apos;ve made</h2></div></div></header>
                {submissions.length > 0 ? <div className="pl-activity-list">{submissions.slice(0, 4).map((item) => <Link to={`/community/${item.id}`} key={item.id}><span>{item.authorInitials}</span><div><b>{item.title}</b><small>{item.projectTitle} · On this device</small></div><ArrowRight size={14} /></Link>)}</div> : <div className="pl-activity-empty"><UploadCloud size={22} /><b>No showcase builds yet</b><p>Finish a project and publish it locally to see it here.</p><Link to="/projects">Find a project</Link></div>}
              </article>
            </section>

            {finishedProjects.length > 0 && (
              <section className="pl-learning-section">
                <div className="pl-section-heading pl-section-heading--split"><div><span className="pl-kicker"><CheckCircle2 size={14} /> Your completed builds</span><h2>Finished — and worth <em>celebrating.</em></h2><p>Reopen any workspace when you want to make the project even better.</p></div><Link className="pl-text-link" to="/projects?status=finished">View project library <ArrowRight size={16} /></Link></div>
                <div className="pl-project-grid">{finishedProjects.slice(0, 6).map((project) => <PublicProjectCard project={project} finished key={project.id} />)}</div>
              </section>
            )}
          </>
        )}

        <div className="pl-learning-tip"><span><BookOpen size={19} /></span><div><b>Your account keeps your progress moving.</b><p>Completed challenges and projects sync to your L2E LAB account in real time. Code drafts, showcase builds, and likes still stay on this browser for now.</p></div><span><Check size={13} /> Account sync</span></div>
      </section>
    </div>
  )
}
