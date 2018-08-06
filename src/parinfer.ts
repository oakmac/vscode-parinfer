import {
  Position,
  Range,
  Selection,
  TextEditorSelectionChangeKind,
  window,
  workspace
} from 'vscode'

import { indentMode, parenMode, smartMode } from 'parinfer'
import { EditorState } from 'editor'
import { editorStates, getEditorRange } from './editor'
import { isString, findEndRow, findStartRow, linesDiff, splitLines } from './utils'
import { parenModeFailedMsg, parenModeChangedFileMsg } from './messages'

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

function applyParinfer2 (editor, event, mode) {
  if (event && event.kind !== TextEditorSelectionChangeKind.Keyboard) {
    return
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
  const startRow = findStartRow(lines, line)
  const endRow = findEndRow(lines, line)
  const opts = {
    cursorLine: line - startRow,
    cursorX: cursor.character
  }
  const linesToInfer = lines.slice(startRow, endRow)
  const textToInfer = linesToInfer.join('\n') + '\n'

  // run Parinfer
  let result = null
  if (mode === 'INDENT_MODE') result = indentMode(textToInfer, opts)
  else if (mode === 'SMART_MODE') result = smartMode(textToInfer, opts)
  else if (mode === 'PAREN_MODE') result = parenMode(textToInfer, opts)

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

function applyParinfer (editor, event) {
  // defensive
  if (!editor) return

  const state = editorStates.deref().get(editor)

  if (isRunState(state)) {
    applyParinfer2(editor, event, state)
  }
}

// run paren mode on the editor when it is first opened / receives focus
function helloEditor2 (editor) {
  const showOpenFileDialog = true
  const currentFile = editor.document.fileName
  const currentText = editor.document.getText()
  const parenModeResult = parenMode(currentText)
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
    let defaultMode = workspace.getConfiguration('parinfer').get < EditorState > ('defaultMode')
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

export { applyParinfer, disableParinfer, helloEditor }
