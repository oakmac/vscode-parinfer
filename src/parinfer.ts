import {
  Position,
  Range,
  Selection,
  TextEditorSelectionChangeKind,
  window,
  workspace
} from 'vscode'

import { indentMode, parenMode } from 'parinfer'
import { EditorState } from 'editor'
import { editorStates, getEditorRange } from './editor'
import { splitLines, findEndRow, findStartRow, linesDiff } from './utils'
import { parenModeFailedMsg, parenModeChangedFileMsg } from './messages'

function disableParinfer (editor) {
  editorStates.update((states) => states.set(editor, 'disabled'))
}

function applyParinfer2 (editor, event, mode) {
  if (event && event.kind !== TextEditorSelectionChangeKind.Keyboard) {
    return
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
  const result = mode === 'paren-mode' ? parenMode(textToInfer, opts) : indentMode(textToInfer, opts)
  const parinferSuccess = result.success
  const inferredText = parinferSuccess ? result.text : false
  const undoOptions = {
    undoStopAfter: false,
    undoStopBefore: false
  }

  if (typeof inferredText === 'string' && inferredText !== textToInfer) {
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

function applyParinfer (editor, event) {
  const state = editorStates.deref().get(editor)

  if (editor && state) {
    if (state === 'indent-mode') {
      applyParinfer2(editor, event, 'indent-mode')
    }
    if (state === 'paren-mode') {
      applyParinfer2(editor, event, 'paren-mode')
    }
  }
}

function parinfer (editor) {
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
      return states.set(editor, 'disabled')
    } else {
      shouldInit = false
      return states.set(editor, state)
    }
  })

  if (shouldInit) {
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
            editorStates.update((states) => states.set(editor, 'paren-mode'))
          }
        })
    } else if (!parenModeSucceeded && !showOpenFileDialog) {
      editorStates.update((states) => states.set(editor, 'paren-mode'))
    } else if (parenModeChangedFile && showOpenFileDialog) {
      window.showInformationMessage(parenModeChangedFileMsg(currentFile, textDelta.diff), 'Yes', 'No')
        .then((btn) => {
          if (btn === 'Yes') {
            editor.edit((edit) => {
              edit.replace(getEditorRange(editor), parenModeText)
            })
            editorStates.update((states) => states.set(editor, 'indent-mode'))
          }
        })
    } else if (parenModeChangedFile && !showOpenFileDialog) {
      editor.edit((edit) => {
        edit.replace(getEditorRange(editor), parenModeText)
      })
      editorStates.update((states) => states.set(editor, 'indent-mode'))
    } else {
      let defaultMode = workspace.getConfiguration('parinfer').get < EditorState > ('defaultMode')
      editorStates.update((states) => states.set(editor, defaultMode))
    }
  }
}

export {applyParinfer, disableParinfer, parinfer}
