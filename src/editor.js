const vscode = require('vscode')
const Range = vscode.Range

const util = require('./util')

const editorStates = util.atom(new WeakMap())

function getEditorRange (editor) {
  const document = editor.document
  const invalidRange = new Range(0, 0, document.lineCount + 5, 0)
  return document.validateRange(invalidRange)
}

exports.editorStates = editorStates
exports.getEditorRange = getEditorRange
