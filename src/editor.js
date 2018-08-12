const vscode = require('vscode')
const Position = vscode.Position
const Range = vscode.Range

const util = require('./util')

const editorStates = util.atom(new WeakMap())

function getEditorRange (editor) {
  const line = editor.document.lineCount - 1
  const character = editor.document.lineAt(line).text.length
  return new Range(new Position(0, 0), new Position(line, character))
}

exports.editorStates = editorStates
exports.getEditorRange = getEditorRange
