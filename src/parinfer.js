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

const undoOptions = {
  undoStopAfter: false,
  undoStopBefore: false
}

const logParinferInput = false
const logParinferOutput = false

function applyParinfer2 (editor, inputText, opts, mode) {
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

  console.assert(Number.isInteger(result.cursorLine), 'Parinfer result.cursorLine is not an integer')
  console.assert(Number.isInteger(result.cursorX), 'Parinfer result.cursorX is not an integer')

  if (logParinferOutput) {
    console.log(result)
    console.log('~~~~~~~~~~~~~~~~ parinfer output ~~~~~~~~~~~~~~~~')
  }

  // exit if parinfer was not successful
  // FIXME: I think there are some cases where we can show an error here?
  if (!result.success) return

  const didTextChange = result.text !== inputText

  const isSelectionEmpty = editor.selection.isEmpty
  const anchorPosition = editor.selection.anchor
  const newCursorPosition = new Position(result.cursorLine, result.cursorX)
  let newSelection = null
  if (isSelectionEmpty) {
    newSelection = new Selection(newCursorPosition, newCursorPosition)
  } else {
    newSelection = new Selection(anchorPosition, newCursorPosition)
  }

  // text unchanged: just update the paren trails
  if (!didTextChange) {
    state.prevTxt = result.text
    updateParenTrails(mode, editor, result.parenTrails)
  // text changed
  } else {
    state.ignoreDocumentVersion = editor.document.version + 1
    const editPromise = editor.edit(function (editBuilder) {
      // NOTE: should this be delete + insert instead?
      // https://github.com/Microsoft/vscode/issues/32058
      editBuilder.replace(editorModule.getEditorRange(editor), result.text)
    }, undoOptions)

    // FYI - https://github.com/Microsoft/vscode/issues/16389
    editPromise.then(function (editWasApplied) {
      if (editWasApplied) {
        editor.selection = newSelection
        state.prevTxt = result.text
        updateParenTrails(mode, editor, result.parenTrails)
      } else {
        // TODO: should we do something here if the edit fails?
      }
    })
  }
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
