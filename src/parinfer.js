const vscode = require('vscode')
const Position = vscode.Position
const Range = vscode.Range
const Selection = vscode.Selection
const TextEditorSelectionChangeKind = vscode.TextEditorSelectionChangeKind
const window = vscode.window
const workspace = vscode.workspace

const parinfer = require('parinfer')

const editor2 = require('./editor')
const editorStates = editor2.editorStates
const getEditorRange = editor2.getEditorRange

const util = require('./utils')
const isString = util.isString
const findEndRow = util.findEndRow
const findStartRow = util.findStartRow
const linesDiff = util.linesDiff
const splitLines = util.splitLines

const messages = require('./messages')
const parenModeFailedMsg = messages.parenModeFailedMsg
const parenModeChangedFileMsg = messages.parenModeChangedFileMsg

function disableParinfer (editor) {
  editorStates.update((states) => states.set(editor, 'DISABLED'))
}

// Parinfer Smart mode needs:
// - input text
// - cursorLine
// - cursorX
// - prevCursorLine
// - prevCursorX
// - selectionStartLine - first line of the current selection
// - changes array
//   - lineNo
//   - x
//   - oldText
//   - newText
// - forceBalance
// - partialResult

let prevCursorLine = null
let prevCursorX = null

function applyParinfer2 (editor, event, mode, opts) {
  if (!opts) {
    opts = {}
  }

  // FIXME: development hack
  if (mode === 'INDENT_MODE') {
    mode = 'SMART_MODE'
  }

  const currentText = editor.document.getText()
  const lines = splitLines(currentText)

  if (lines[lines.length - 1] !== '') {
    lines.push('')
  }

  const cursor = event ? event.selections[0].active : editor.selection.active
  const line = cursor.line
  // const startRow = findStartRow(lines, line)
  // const endRow = findEndRow(lines, line)
  const startRow = 0
  const endRow = lines.length - 1
  opts.cursorLine = line - startRow
  opts.cursorX = cursor.character

  // const opts = {
  //   changes: changes,
  //   cursorLine: line - startRow,
  //   cursorX: cursor.character
  // }
  const linesToInfer = lines.slice(startRow, endRow)
  const textToInfer = linesToInfer.join('\n') + '\n'

  // run Parinfer
  let result = null
  if (mode === 'INDENT_MODE') result = parinfer.indentMode(textToInfer, opts)
  else if (mode === 'SMART_MODE') result = parinfer.smartMode(textToInfer, opts)
  else if (mode === 'PAREN_MODE') result = parinfer.parenMode(textToInfer, opts)

  const parinferSuccess = result.success
  const inferredText = parinferSuccess ? result.text : false
  const undoOptions = {
    undoStopAfter: false,
    undoStopBefore: false
  }

  if (isString(inferredText) && inferredText !== textToInfer) {
    editor.edit(function (edit) {
      edit.replace(
        new Range(new Position(startRow, 0), new Position(endRow, 0)),
        inferredText
      )
    }, undoOptions)
      .then(function (applied) {
        if (applied) {
          const cursor = editor.selection.active
          const nextCursor = cursor.with(cursor.line, result.cursorX)
          editor.selection = new Selection(nextCursor, nextCursor)
        }
      })
  }
}

function isRunState (state) {
  return state === 'INDENT_MODE' ||
         state === 'SMART_MODE' ||
         state === 'PAREN_MODE'
}

function applyParinfer (editor, event, opts) {
  // defensive
  if (!editor) return

  // do not apply Parinfer if the change event did not originate from a key press
  if (event && event.kind !== TextEditorSelectionChangeKind.Keyboard) {
    return
  }

  const state = editorStates.deref().get(editor)

  if (isRunState(state)) {
    applyParinfer2(editor, event, state, opts)
  }
}

// run paren mode on the editor when it is first opened / receives focus
function helloEditor2 (editor) {
  const showOpenFileDialog = true
  const currentFile = editor.document.fileName
  const currentText = editor.document.getText()
  const parenModeResult = parinfer.parenMode(currentText)
  const parenModeSucceeded = parenModeResult.success === true
  const parenModeText = parenModeResult.text
  const textDelta = linesDiff(currentText, parenModeText)
  const parenModeChangedFile = parenModeSucceeded && textDelta.diff !== 0

  if (!parenModeSucceeded && showOpenFileDialog) {
    window.showInformationMessage(parenModeFailedMsg(currentFile), 'Ok')
      .then((btn) => {
        if (btn === 'Ok') {
          editorStates.update((states) => states.set(editor, 'PAREN_MODE'))
        }
      })
  } else if (!parenModeSucceeded && !showOpenFileDialog) {
    editorStates.update((states) => states.set(editor, 'PAREN_MODE'))
  } else if (parenModeChangedFile && showOpenFileDialog) {
    window.showInformationMessage(parenModeChangedFileMsg(currentFile, textDelta.diff), 'Yes', 'No')
      .then((btn) => {
        if (btn === 'Yes') {
          editor.edit((edit) => {
            edit.replace(getEditorRange(editor), parenModeText)
          })
          editorStates.update((states) => states.set(editor, 'INDENT_MODE'))
        }
      })
  } else if (parenModeChangedFile && !showOpenFileDialog) {
    editor.edit((edit) => {
      edit.replace(getEditorRange(editor), parenModeText)
    })
    editorStates.update((states) => states.set(editor, 'INDENT_MODE'))
  } else {
    let defaultMode = workspace.getConfiguration('parinfer').get('defaultMode')
    editorStates.update((states) => states.set(editor, defaultMode))
  }
}

function helloEditor (editor) {
  // This duplicates same languages in package.json under activationEvents.
  // They might be needed here too in case parinfer somehow bypasses those activationEvents?
  let shouldInit = (
    editor.document.languageId === 'clojure' ||
    editor.document.languageId === 'scheme' ||
    editor.document.languageId === 'lisp' ||
    editor.document.languageId === 'racket'
  )

  editorStates.update(function (states) {
    const state = states.get(editor)

    if (!state && !shouldInit) {
      return states.set(editor, state)
    } else if (!state) {
      return states.set(editor, 'DISABLED')
    } else {
      shouldInit = false
      return states.set(editor, state)
    }
  })

  if (shouldInit) {
    helloEditor2(editor)
  }
}

exports.applyParinfer = applyParinfer
exports.disableParinfer = disableParinfer
exports.helloEditor = helloEditor
