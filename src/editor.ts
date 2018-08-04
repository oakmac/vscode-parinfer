import { Position, Range } from 'vscode'
import { atom } from './utils'

const editorStates = atom(new WeakMap())

function getEditorRange (editor) {
  const line = editor.document.lineCount - 1
  const character = editor.document.lineAt(line).text.length
  return new Range(new Position(0, 0), new Position(line, character))
}

export { editorStates, getEditorRange }
