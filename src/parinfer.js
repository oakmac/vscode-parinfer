const vscode = require('vscode')
const Position = vscode.Position
const Range = vscode.Range
const Selection = vscode.Selection

const window = vscode.window
const workspace = vscode.workspace

const parinfer = require('parinfer')

const editor2 = require('./editor')
const editorStates = editor2.editorStates
const getEditorRange = editor2.getEditorRange

const util = require('./util')
const linesDiff = util.linesDiff

const messages = require('./messages')
const parenModeFailedMsg = messages.parenModeFailedMsg
const parenModeChangedFileMsg = messages.parenModeChangedFileMsg

function disableParinfer (editor) {
  editorStates.update((states) => states.set(editor, 'DISABLED'))
}

function applyParinfer2 (editor, inputText, opts, mode) {
  if (!opts) {
    opts = {}
  }

  // FIXME: development hack
  if (mode === 'INDENT_MODE') {
    mode = 'SMART_MODE'
  }

  // run Parinfer
  let result = null
  if (mode === 'INDENT_MODE') result = parinfer.indentMode(inputText, opts)
  else if (mode === 'SMART_MODE') result = parinfer.smartMode(inputText, opts)
  else if (mode === 'PAREN_MODE') result = parinfer.parenMode(inputText, opts)

  // exit if parinfer was not successful
  // FIXME: I think there are some cases where we can show an error here?
  if (!result.success) return

  // exit if the text does not need to be changed
  if (result.text === inputText) return

  const currentCursor = editor.selection
  const document = editor.document
  const invalidRange = new Range(0, 0, document.lineCount + 5, 0)
  const fullRange = document.validateRange(invalidRange)
  const undoOptions = {
    undoStopAfter: false,
    undoStopBefore: false
  }
  const editPromise = editor.edit(function (editBuilder) {
    editBuilder.replace(fullRange, result.text)
  }, undoOptions)

  editPromise.then(function (editWasApplied) {
    if (editWasApplied) {
      const newCursorPosition = new Position(result.cursorLine, result.cursorX)
      const nextCursor = new Selection(currentCursor.anchor, newCursorPosition)
      editor.selection = nextCursor // new Selection(nextCursor, nextCursor)
    }
  })
}

function isRunState (state) {
  return state === 'INDENT_MODE' ||
         state === 'SMART_MODE' ||
         state === 'PAREN_MODE'
}

function applyParinfer (editor, text, opts) {
  // defensive
  if (!editor) return

  const state = editorStates.deref().get(editor)

  if (isRunState(state)) {
    applyParinfer2(editor, text, opts, state)
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
