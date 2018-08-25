const vscode = require('vscode')
const Position = vscode.Position
const Selection = vscode.Selection
const window = vscode.window
const workspace = vscode.workspace
const parinfer = require('parinfer')
const parenTrailsModule = require('./parentrails')
const updateParenTrails = parenTrailsModule.updateParenTrails
const editorModule = require('./editor')
const editorStates = editorModule.editorStates
const util = require('./util')
const messages = require('./messages')
const parenModeFailedMsg = messages.parenModeFailedMsg
const parenModeChangedFileMsg = messages.parenModeChangedFileMsg
const config = require('./config')
const state = require('./state')

// -----------------------------------------------------------------------------
// Parinfer Application
// -----------------------------------------------------------------------------

const logParinferInput = false
const logParinferOutput = false

const undoOptions = {
  undoStopAfter: false,
  undoStopBefore: false
}

function applyParinfer2 (editor, inputText, opts, mode) {
  if (!opts) {
    opts = {}
  }

  if (logParinferInput) {
    console.log(inputText)
    console.log(opts)
    console.log('~~~~~~~~~~~~~~~~ parinfer input ~~~~~~~~~~~~~~~~')
  }

  // run Parinfer
  let result = null
  if (mode === 'INDENT_MODE') result = parinfer.indentMode(inputText, opts)
  else if (mode === 'SMART_MODE') result = parinfer.smartMode(inputText, opts)
  else if (mode === 'PAREN_MODE') result = parinfer.parenMode(inputText, opts)

  if (logParinferOutput) {
    console.log(result)
    console.log('~~~~~~~~~~~~~~~~ parinfer output ~~~~~~~~~~~~~~~~')
  }

  // exit if parinfer was not successful
  // FIXME: I think there are some cases where we can show an error here?
  if (!result.success) return

  const hasTextChanged = result.text !== inputText
  const currentCursorLine = editor.selections[0].start.line
  const currentCursorX = editor.selections[0].start.character

  let hasCursorChanged = false
  let nextCursor = false
  if (result.hasOwnProperty('cursorLine') && result.hasOwnProperty('cursorX')) {
    hasCursorChanged = !areCursorsEqual(
      currentCursorLine, currentCursorX, result.cursorLine, result.cursorX
    )
    const newCursorPosition = new Position(result.cursorLine, result.cursorX)
    nextCursor = new Selection(newCursorPosition, newCursorPosition)
  }

  // text and cursor unchanged: just update the paren trails
  if (!hasTextChanged && !hasCursorChanged) {
    updateParenTrails(mode, editor, result.parenTrails)
  // text unchanged, but cursor needs to be updated
  } else if (!hasTextChanged && hasCursorChanged) {
    editor.selection = nextCursor
    updateParenTrails(mode, editor, result.parenTrails)
  // text changed
  } else if (hasTextChanged) {
    state.ignoreDocumentVersion = editor.document.version + 1
    state.ignoreNextSelectionChange = true
    const editPromise = editor.edit(function (editBuilder) {
      // NOTE: should this be delete + insert instead?
      // https://github.com/Microsoft/vscode/issues/32058
      editBuilder.replace(editorModule.getEditorRange(editor), result.text)
    }, undoOptions)

    // FYI - https://github.com/Microsoft/vscode/issues/16389
    editPromise.then(function (editWasApplied) {
      if (editWasApplied) {
        if (nextCursor) {
          editor.selection = nextCursor
        }
        updateParenTrails(mode, editor, result.parenTrails)
      } else {
        // TODO: should we do something here if the edit fails?
      }
    })
  }
}

function areCursorsEqual (oldCursorLine, oldCursorX, newCursorLine, newCursorX) {
  return Number.isInteger(newCursorLine) &&
         Number.isInteger(newCursorX) &&
         oldCursorLine === newCursorLine &&
         oldCursorX === newCursorX
}

function applyParinfer (editor, text, opts) {
  // defensive
  if (!editor) return

  const state = editorStates.deref().get(editor)

  if (util.isRunState(state)) {
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
  const textDelta = util.linesDiff(currentText, parenModeText)
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
            edit.replace(editorModule.getEditorRange(editor), parenModeText)
          })
          const activeState = config.useSmartMode ? 'SMART_MODE' : 'INDENT_MODE'
          editorStates.update((states) => states.set(editor, activeState))
        }
      })
  } else if (parenModeChangedFile && !showOpenFileDialog) {
    editor.edit((edit) => {
      edit.replace(editorModule.getEditorRange(editor), parenModeText)
    })
    const activeState = config.useSmartMode ? 'SMART_MODE' : 'INDENT_MODE'
    editorStates.update((states) => states.set(editor, activeState))
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
exports.helloEditor = helloEditor
