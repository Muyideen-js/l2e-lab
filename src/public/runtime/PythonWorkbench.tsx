import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type BeforeMount, type Monaco, type OnMount } from '@monaco-editor/react'
import { AlertTriangle, Check, CircleStop, LoaderCircle, Play, RotateCcw, Terminal, TestTube2, X } from 'lucide-react'
import type { ValidationRule } from '../types'
import './monacoSetup'
import { acquirePythonAutocomplete } from './pythonAutocomplete'
import { usePythonRunner, type PythonCheckResult, type PythonRunResult } from './usePythonRunner'

type Props = {
  code: string
  onChange: (code: string) => void
  validation?: ValidationRule[]
  onCheckComplete?: (passed: boolean, results: PythonCheckResult[]) => void
  height?: number
  filename?: string
  onEditorMount?: OnMount
}

function formatReturnValue(value: unknown) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

export function PythonWorkbench({
  code,
  onChange,
  validation = [],
  onCheckComplete,
  height = 620,
  filename = 'main.py',
  onEditorMount,
}: Props) {
  const runner = usePythonRunner()
  const [result, setResult] = useState<PythonRunResult | null>(null)
  const [mode, setMode] = useState<'output' | 'checks'>('output')
  const autocompleteLeaseRef = useRef<{ dispose: () => void } | null>(null)
  const monacoInstanceRef = useRef<Monaco | null>(null)

  useEffect(() => {
    if (monacoInstanceRef.current && !autocompleteLeaseRef.current) {
      autocompleteLeaseRef.current = acquirePythonAutocomplete(monacoInstanceRef.current)
    }
    return () => {
      autocompleteLeaseRef.current?.dispose()
      autocompleteLeaseRef.current = null
    }
  }, [])

  const prepareEditor: BeforeMount = useCallback((monaco) => {
    monaco.editor.defineTheme('l2e-python', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '657B96', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC' },
        { token: 'string', foreground: '86EFAC' },
        { token: 'number', foreground: 'FBBF24' },
      ],
      colors: {
        'editor.background': '#071426',
        'editorLineNumber.foreground': '#3f5874',
        'editorLineNumber.activeForeground': '#9ab2ce',
        'editorCursor.foreground': '#38bdf8',
        'editor.selectionBackground': '#164a735c',
        'editorSuggestWidget.background': '#0b1c31',
        'editorSuggestWidget.border': '#274562',
        'editorSuggestWidget.foreground': '#bdd0e4',
        'editorSuggestWidget.highlightForeground': '#55c8fb',
        'editorSuggestWidget.selectedBackground': '#153a5b',
      },
    })
  }, [])

  const mountEditor: OnMount = useCallback((_, monaco) => {
    monaco.editor.setTheme('l2e-python')
    monacoInstanceRef.current = monaco
    autocompleteLeaseRef.current?.dispose()
    autocompleteLeaseRef.current = acquirePythonAutocomplete(monaco)
    onEditorMount?.(_, monaco)
  }, [onEditorMount])

  async function runCode() {
    setMode('output')
    const next = await runner.run(code)
    setResult(next)
  }

  async function checkCode() {
    setMode('checks')
    const next = await runner.check(code, validation)
    setResult(next)
    const passed = next.ok && next.checks.length > 0 && next.checks.every((check) => check.passed)
    onCheckComplete?.(passed, next.checks)
  }

  const terminalOutput = result?.stdout || result?.stderr || result?.error || formatReturnValue(result?.returnValue) || 'Run your code to see its output here.'

  return (
    <section className="python-workbench" aria-label="Python coding workspace" style={{ '--runtime-height': `${height}px` } as React.CSSProperties}>
      <div className="python-workbench__topbar">
        <div className="python-file-label">
          <span className="python-glyph">Py</span>{filename}<i>Saved locally</i>
          <span className="python-editor-hint" title="Open Python autocomplete suggestions">
            <kbd>Ctrl</kbd><b>+</b><kbd>Space</kbd> suggestions
          </span>
        </div>
        <div className="python-actions">
          {runner.isBusy ? (
            <button type="button" className="runtime-button runtime-button--stop" onClick={runner.stop}><CircleStop size={15} /> Stop</button>
          ) : (
            <>
              {validation.length > 0 && <button type="button" className="runtime-button runtime-button--check" onClick={checkCode}><TestTube2 size={15} /> Check work</button>}
              <button type="button" className="runtime-button runtime-button--run" onClick={runCode}><Play size={15} fill="currentColor" /> Run code</button>
            </>
          )}
        </div>
      </div>
      <div className="python-workbench__body">
        <div className="python-editor-pane">
          <Editor
            height="100%"
            language="python"
            value={code}
            onChange={(value) => onChange(value ?? '')}
            theme="vs-dark"
            beforeMount={prepareEditor}
            onMount={mountEditor}
            options={{
              minimap: { enabled: false },
              fontFamily: 'Cascadia Code, Consolas, monospace',
              fontSize: 13,
              lineHeight: 23,
              padding: { top: 18, bottom: 18 },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              detectIndentation: false,
              wordWrap: 'on',
              quickSuggestions: { other: true, comments: false, strings: false },
              quickSuggestionsDelay: 60,
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnCommitCharacter: true,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'on',
              snippetSuggestions: 'top',
              suggestSelection: 'first',
              wordBasedSuggestions: 'off',
              parameterHints: { enabled: true, cycle: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoSurround: 'languageDefined',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
            }}
          />
        </div>
        <aside className="python-output-pane">
          <header>
            <div className="python-output-tabs">
              <button type="button" className={mode === 'output' ? 'is-active' : ''} onClick={() => setMode('output')}><Terminal size={14} /> Output</button>
              {validation.length > 0 && <button type="button" className={mode === 'checks' ? 'is-active' : ''} onClick={() => setMode('checks')}><TestTube2 size={14} /> Checks {result?.checks.length ? `(${result.checks.filter((item) => item.passed).length}/${result.checks.length})` : ''}</button>}
            </div>
            {result && <span>{result.durationMs}ms</span>}
          </header>

          <div className="python-output-content">
            {runner.isBusy && (
              <div className="runtime-loading">
                <span><LoaderCircle className="spin" size={21} /></span>
                <strong>{runner.state === 'loading' ? 'Loading Python in your browser' : 'Running your code'}</strong>
                <p>{runner.state === 'loading' ? 'The first run downloads the Python engine. Later runs are much faster.' : 'Your program is running safely in a separate worker.'}</p>
              </div>
            )}

            {!runner.isBusy && runner.loadError && !result && (
              <div className="runtime-error-card">
                <AlertTriangle size={20} />
                <div><strong>Python did not load</strong><p>{runner.loadError}</p></div>
                <button onClick={runner.retry}><RotateCcw size={14} /> Try again</button>
              </div>
            )}

            {!runner.isBusy && mode === 'output' && (
              <pre className={result && !result.ok ? 'has-error' : ''}>{terminalOutput}</pre>
            )}

            {!runner.isBusy && mode === 'checks' && (
              <div className="runtime-checks">
                {!result?.checks.length && <div className="runtime-checks__empty"><TestTube2 size={22} /><strong>No checks yet</strong><p>Choose “Check work” to test your project requirements.</p></div>}
                {result?.checks.map((check) => (
                  <article key={check.id} className={check.passed ? 'is-passed' : 'is-failed'}>
                    <span>{check.passed ? <Check size={15} /> : <X size={15} />}</span>
                    <div><strong>{check.label}</strong>{check.message && <p>{check.message}</p>}</div>
                  </article>
                ))}
                {result && !result.ok && <article className="is-failed"><span><X size={15} /></span><div><strong>Your code stopped before the checks</strong><p>{result.error}</p></div></article>}
              </div>
            )}
          </div>
          <footer><span className={runner.state === 'ready' ? 'is-online' : ''} /> Python {runner.state === 'ready' ? 'ready' : runner.state === 'error' ? 'needs attention' : 'runs in this browser'}</footer>
        </aside>
      </div>
    </section>
  )
}
