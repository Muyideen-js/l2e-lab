import type { Monaco } from '@monaco-editor/react'
import type { editor, Position } from 'monaco-editor'

type Disposable = { dispose: () => void }

type CompletionTemplate = {
  label: string
  detail: string
  documentation: string
  insertText: string
  kind: 'function' | 'keyword' | 'snippet' | 'constant' | 'method'
  sortText: string
}

const coreCompletions: CompletionTemplate[] = [
  {
    label: 'print',
    detail: 'Show a value in Output',
    documentation: 'Print text, numbers, or variables to the output panel.',
    insertText: 'print(${1:value})',
    kind: 'function',
    sortText: '01-print',
  },
  {
    label: 'input',
    detail: 'Ask the user for text',
    documentation: 'Read a line of text entered by the user.',
    insertText: 'input("${1:Enter a value: }")',
    kind: 'function',
    sortText: '02-input',
  },
  {
    label: 'for',
    detail: 'Loop through a collection',
    documentation: 'Repeat an indented block once for every item.',
    insertText: 'for ${1:item} in ${2:items}:\n\t${3:print(item)}',
    kind: 'snippet',
    sortText: '03-for',
  },
  {
    label: 'for range',
    detail: 'Repeat a block a number of times',
    documentation: 'Use range() when you want a counted loop.',
    insertText: 'for ${1:number} in range(${2:5}):\n\t${3:print(number)}',
    kind: 'snippet',
    sortText: '04-for-range',
  },
  {
    label: 'if',
    detail: 'Run code when a condition is true',
    documentation: 'Create an if statement with an indented body.',
    insertText: 'if ${1:condition}:\n\t${2:print("Condition is true")}',
    kind: 'snippet',
    sortText: '05-if',
  },
  {
    label: 'if / else',
    detail: 'Choose between two paths',
    documentation: 'Run one block when the condition is true and another when it is false.',
    insertText: 'if ${1:condition}:\n\t${2:print("Yes")}\nelse:\n\t${3:print("No")}',
    kind: 'snippet',
    sortText: '06-if-else',
  },
  {
    label: 'while',
    detail: 'Repeat while a condition is true',
    documentation: 'Remember to update the condition inside the loop so it can finish.',
    insertText: 'while ${1:condition}:\n\t${2:# Write your code here}',
    kind: 'snippet',
    sortText: '07-while',
  },
  {
    label: 'def',
    detail: 'Create a reusable function',
    documentation: 'Define a named function and its parameters.',
    insertText: 'def ${1:function_name}(${2:parameter}):\n\t${3:return parameter}',
    kind: 'snippet',
    sortText: '08-def',
  },
  {
    label: 'list',
    detail: 'Create an empty list',
    documentation: 'Lists store ordered values that you can change.',
    insertText: '${1:items} = [${2}]',
    kind: 'snippet',
    sortText: '09-list',
  },
  {
    label: 'dictionary',
    detail: 'Create a dictionary',
    documentation: 'Dictionaries store values using named keys.',
    insertText: '${1:person} = {\n\t"${2:name}": ${3:"Yaomin"},\n\t"${4:age}": ${5:18}\n}',
    kind: 'snippet',
    sortText: '10-dictionary',
  },
  {
    label: 'f-string',
    detail: 'Put a value inside text',
    documentation: 'Prefix a string with f and place expressions inside braces.',
    insertText: 'f"${1:Hello}, {${2:name}}!"',
    kind: 'snippet',
    sortText: '11-f-string',
  },
  {
    label: 'try / except',
    detail: 'Handle an error safely',
    documentation: 'Try an operation and handle a predictable error.',
    insertText: 'try:\n\t${1:value = int(input("Enter a number: "))}\nexcept ${2:ValueError}:\n\t${3:print("Please enter a valid number.")}',
    kind: 'snippet',
    sortText: '12-try',
  },
  {
    label: 'import',
    detail: 'Import a Python module',
    documentation: 'Make a module available in the current file.',
    insertText: 'import ${1:math}',
    kind: 'snippet',
    sortText: '13-import',
  },
  {
    label: 'from import',
    detail: 'Import one item from a module',
    documentation: 'Import a specific function, class, or value.',
    insertText: 'from ${1:module} import ${2:name}',
    kind: 'snippet',
    sortText: '14-from-import',
  },
  {
    label: 'main guard',
    detail: 'Run code only when this file starts directly',
    documentation: 'A common Python pattern for choosing the program entry point.',
    insertText: 'if __name__ == "__main__":\n\t${1:main()}',
    kind: 'snippet',
    sortText: '15-main-guard',
  },
  ...[
    ['len', 'Count the items in a value', 'len(${1:value})'],
    ['range', 'Create a sequence of numbers', 'range(${1:stop})'],
    ['str', 'Convert a value to text', 'str(${1:value})'],
    ['int', 'Convert a value to an integer', 'int(${1:value})'],
    ['float', 'Convert a value to a decimal number', 'float(${1:value})'],
    ['list', 'Convert a value to a list', 'list(${1:value})'],
    ['dict', 'Create or convert to a dictionary', 'dict(${1})'],
    ['set', 'Create a collection of unique values', 'set(${1:value})'],
    ['tuple', 'Create an immutable sequence', 'tuple(${1:value})'],
    ['sum', 'Add the numbers in a collection', 'sum(${1:values})'],
    ['min', 'Find the smallest value', 'min(${1:values})'],
    ['max', 'Find the largest value', 'max(${1:values})'],
    ['sorted', 'Return values in sorted order', 'sorted(${1:values})'],
    ['enumerate', 'Loop with each item and its index', 'enumerate(${1:items})'],
    ['zip', 'Pair values from multiple collections', 'zip(${1:first}, ${2:second})'],
    ['round', 'Round a number', 'round(${1:number}, ${2:2})'],
    ['abs', 'Get the absolute value of a number', 'abs(${1:number})'],
    ['type', 'Check the type of a value', 'type(${1:value})'],
    ['isinstance', 'Check whether a value has a type', 'isinstance(${1:value}, ${2:str})'],
  ].map(([label, detail, insertText], index): CompletionTemplate => ({
    label,
    detail,
    documentation: detail,
    insertText,
    kind: 'function',
    sortText: `2${String(index).padStart(2, '0')}-${label}`,
  })),
  ...[
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'del',
    'elif', 'else', 'except', 'finally', 'from', 'global', 'if', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'with', 'yield',
  ].map((label, index): CompletionTemplate => ({
    label,
    detail: 'Python keyword',
    documentation: `${label} is a reserved Python keyword.`,
    insertText: label,
    kind: 'keyword',
    sortText: `3${String(index).padStart(2, '0')}-${label}`,
  })),
  ...[
    ['True', 'Boolean true value'],
    ['False', 'Boolean false value'],
    ['None', 'Represents no value'],
  ].map(([label, detail], index): CompletionTemplate => ({
    label,
    detail,
    documentation: detail,
    insertText: label,
    kind: 'constant',
    sortText: `4${index}-${label}`,
  })),
]

const memberCompletions: CompletionTemplate[] = [
  ['append', 'Add one item to the end of a list', 'append(${1:item})'],
  ['extend', 'Add every item from another collection', 'extend(${1:items})'],
  ['insert', 'Add an item at a specific position', 'insert(${1:index}, ${2:item})'],
  ['pop', 'Remove and return an item', 'pop(${1})'],
  ['remove', 'Remove the first matching item', 'remove(${1:item})'],
  ['sort', 'Sort a list in place', 'sort()'],
  ['reverse', 'Reverse a list in place', 'reverse()'],
  ['count', 'Count matching values', 'count(${1:value})'],
  ['index', 'Find the position of a value', 'index(${1:value})'],
  ['upper', 'Return uppercase text', 'upper()'],
  ['lower', 'Return lowercase text', 'lower()'],
  ['title', 'Capitalize each word', 'title()'],
  ['strip', 'Remove surrounding whitespace', 'strip()'],
  ['split', 'Split text into a list', 'split(${1})'],
  ['replace', 'Replace part of a string', 'replace(${1:old}, ${2:new})'],
  ['startswith', 'Check the beginning of a string', 'startswith(${1:prefix})'],
  ['endswith', 'Check the end of a string', 'endswith(${1:suffix})'],
  ['get', 'Read a dictionary value safely', 'get(${1:key}, ${2:default})'],
  ['keys', 'Return the keys in a dictionary', 'keys()'],
  ['values', 'Return the values in a dictionary', 'values()'],
  ['items', 'Return dictionary key-value pairs', 'items()'],
].map(([label, detail, insertText], index): CompletionTemplate => ({
  label,
  detail,
  documentation: detail,
  insertText,
  kind: 'method',
  sortText: `0${String(index).padStart(2, '0')}-${label}`,
}))

function completionKind(monaco: Monaco, kind: CompletionTemplate['kind']) {
  if (kind === 'function') return monaco.languages.CompletionItemKind.Function
  if (kind === 'keyword') return monaco.languages.CompletionItemKind.Keyword
  if (kind === 'constant') return monaco.languages.CompletionItemKind.Constant
  if (kind === 'method') return monaco.languages.CompletionItemKind.Method
  return monaco.languages.CompletionItemKind.Snippet
}

function createProvider(monaco: Monaco): Disposable {
  return monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    provideCompletionItems(model: editor.ITextModel, position: Position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      const beforeCursor = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
      const templates = /\.\w*$/.test(beforeCursor) ? memberCompletions : coreCompletions
      return {
        suggestions: templates.map((item) => ({
          label: item.label,
          detail: item.detail,
          documentation: item.documentation,
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          kind: completionKind(monaco, item.kind),
          range,
          sortText: item.sortText,
        })),
      }
    },
  })
}

let sharedProvider: {
  monaco: Monaco
  registration: Disposable
  leases: Set<symbol>
} | null = null

/**
 * Shares one Python provider across mounted workbenches and disposes it when
 * the last editor unmounts. This prevents duplicate suggestions in StrictMode.
 */
export function acquirePythonAutocomplete(monaco: Monaco): Disposable {
  if (!sharedProvider || sharedProvider.monaco !== monaco) {
    sharedProvider?.registration.dispose()
    sharedProvider = {
      monaco,
      registration: createProvider(monaco),
      leases: new Set(),
    }
  }

  const provider = sharedProvider
  const lease = Symbol('python-autocomplete-lease')
  provider.leases.add(lease)
  let released = false

  return {
    dispose() {
      if (released) return
      released = true
      provider.leases.delete(lease)
      if (sharedProvider === provider && provider.leases.size === 0) {
        provider.registration.dispose()
        sharedProvider = null
      }
    },
  }
}
