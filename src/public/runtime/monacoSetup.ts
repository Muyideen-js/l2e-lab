import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/editor/contrib/parameterHints/browser/parameterHints'
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2'
import 'monaco-editor/editor/contrib/suggest/browser/suggestController'
import 'monaco-editor/languages/definitions/python/register'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'

type MonacoEnvironmentHost = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: () => Worker
  }
}

;(globalThis as MonacoEnvironmentHost).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

loader.config({ monaco })
