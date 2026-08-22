import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Code2,
  Filter,
  LockKeyhole,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { isTrackAvailable } from '../../public/availability'
import { publicProjects } from '../../public/data'
import { usePublicProgress } from '../../public/PublicProgressContext'
import { hasProjectDraft } from '../../public/runtime/storage'
import { PublicProjectCard, TrackIcon, trackName } from '../../public/PublicCards'
import type { LearningDifficulty, LearningTrack } from '../../public/types'

type TrackFilter = LearningTrack | 'all'
type DifficultyFilter = LearningDifficulty | 'all'
type StatusFilter = 'all' | 'unfinished' | 'finished'

const tracks: TrackFilter[] = ['all', 'python', 'react', 'javascript']
const difficulties: DifficultyFilter[] = ['all', 'Beginner', 'Intermediate', 'Advanced']

export function PublicProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTrack = searchParams.get('track')
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState<TrackFilter>(
    initialTrack === 'python' || initialTrack === 'react' || initialTrack === 'javascript' ? initialTrack : 'all',
  )
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')
  const initialStatus = searchParams.get('status')
  const [status, setStatus] = useState<StatusFilter>(initialStatus === 'finished' || initialStatus === 'unfinished' ? initialStatus : 'all')
  const { authSession, finishedProjectIds, isProjectFinished } = usePublicProgress()
  const availableProjectCount = publicProjects.filter((project) => isTrackAvailable(project.track)).length

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return publicProjects.filter((project) => {
      const matchesQuery = !needle || [project.title, project.summary, project.kicker, ...project.skills]
        .some((value) => value.toLowerCase().includes(needle))
      const matchesTrack = track === 'all' || project.track === track
      const matchesDifficulty = difficulty === 'all' || project.difficulty === difficulty
      const finished = finishedProjectIds.includes(project.id)
      const matchesStatus = status === 'all' || (status === 'finished' ? finished : !finished)
      return matchesQuery && matchesTrack && matchesDifficulty && matchesStatus
    })
  }, [difficulty, finishedProjectIds, query, status, track])

  function chooseTrack(nextTrack: TrackFilter) {
    setTrack(nextTrack)
    if (nextTrack === 'all') setSearchParams({})
    else setSearchParams({ track: nextTrack })
  }

  function clearFilters() {
    setQuery('')
    setTrack('all')
    setDifficulty('all')
    setStatus('all')
    setSearchParams({})
  }

  const _hasFilters = Boolean(query) || track !== 'all' || difficulty !== 'all' || status !== 'all'

  return (
    <div className="pl-library">
      <section className="pl-library-hero">
        <div className="pl-container">
          <div>
            <span className="pl-kicker"><Sparkles size={14} /> The project library</span>
            <h1>Don&apos;t just study code.<br /><em>Build with it.</em></h1>
            <p>Pick any assessment, create the project in a real browser workspace, run your code, and earn a Finished tag when your checks pass.</p>
          </div>
          <div className="pl-library-hero__summary">
            <span><strong>{availableProjectCount}</strong><small>Python projects open</small></span>
            <i />
            <span><strong>{finishedProjectIds.length}</strong><small>Finished here</small></span>
            <i />
            <span><strong>1</strong><small>Active track</small></span>
          </div>
        </div>
      </section>

      <section className="pl-container pl-library__body">
        <div className="pl-library-toolbar">
          <label className="pl-search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, skills, or ideas..." />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <div className="pl-select-wrap"><SlidersHorizontal size={15} /><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)} aria-label="Filter by difficulty">{difficulties.map((item) => <option value={item} key={item}>{item === 'all' ? 'Any difficulty' : item}</option>)}</select><ChevronDown size={14} /></div>
          <div className="pl-select-wrap"><CheckCircle2 size={15} /><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by completion"><option value="all">Any status</option><option value="unfinished">Not finished</option><option value="finished">Finished</option></select><ChevronDown size={14} /></div>
        </div>

        <div className="pl-library-tabs" role="tablist" aria-label="Project track">
          {tracks.map((item) => (
            <button className={track === item ? 'is-active' : ''} type="button" onClick={() => chooseTrack(item)} key={item}>
              {item === 'all' ? <Code2 size={16} /> : <TrackIcon track={item} />}
              {item === 'all' ? 'All projects' : trackName[item]}
              {item !== 'all' && !isTrackAvailable(item) && <LockKeyhole size={12} aria-label="Coming soon" />}
              <span>{item === 'all' ? publicProjects.length : publicProjects.filter((project) => project.track === item).length}</span>
            </button>
          ))}
        </div>

        <div className="pl-library-results-head">
          <p><b>{filteredProjects.length}</b> {filteredProjects.length === 1 ? 'project' : 'projects'} found</p>
          <span><Filter size={14} /> {track === 'all' ? 'All tracks' : trackName[track]} · {difficulty === 'all' ? 'All levels' : difficulty}</span>
        </div>

        {filteredProjects.length > 0 ? (
          <div className="pl-project-grid pl-project-grid--library">
            {filteredProjects.map((project) => <PublicProjectCard project={project} finished={isProjectFinished(project.id)} inProgress={!isProjectFinished(project.id) && hasProjectDraft(authSession, project.id)} key={project.id} />)}
          </div>
        ) : (
          <div className="pl-empty-state">
            <span><Search size={27} /></span>
            <h2>No projects match that mix.</h2>
            <p>Try another word or clear the filters to see everything you can build.</p>
            <button className="pl-button pl-button--primary" type="button" onClick={clearFilters}>Clear all filters</button>
          </div>
        )}

        <div className="pl-library-callout">
          <div><span><Sparkles size={19} /></span><div><h3>Can&apos;t decide? Start small.</h3><p>The Smart Tip Splitter is a friendly first Python build and takes about 25 minutes.</p></div></div>
          <Link className="pl-button pl-button--primary" to="/projects/smart-tip-splitter">Open starter project</Link>
        </div>
      </section>
    </div>
  )
}
