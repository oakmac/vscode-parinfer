const vscode = require('vscode')
const window = vscode.window

const statusBar = require('./statusbar')

const editor = require('./editor')
const editorStates = editor.editorStates

const parinfer2 = require('./parinfer')

// -----------------------------------------------------------------------------
// Activate
// -----------------------------------------------------------------------------

function onChangeEditorStates (states) {
  const editor = window.activeTextEditor
  const currentEditorState = states.get(editor)

  if (editor && currentEditorState) {
    statusBar.updateStatusBar(currentEditorState)
    if (currentEditorState === 'INDENT_MODE' || currentEditorState === 'PAREN_MODE') {
      parinfer2.applyParinfer(editor, null)
    }
  } else if (editor) {
    statusBar.updateStatusBar(null)
  }
}

editorStates.addWatch(onChangeEditorStates)

function toggleMode (editor) {
  editorStates.update((states) => {
    const nextState = states.get(editor) === 'PAREN_MODE' ? 'INDENT_MODE' : 'PAREN_MODE'
    return states.set(editor, nextState)
  })
}

function activatePane (editor) {
  if (editor) {
    parinfer2.helloEditor(editor)
  }
}

// FIXME: the changes queue needs to be cleared out when the editor changes
let changesQueue = []

function cleanUpChangesQueue () {
  if (changesQueue.length > 10) {
    changesQueue.length = 10
  }
}

setInterval(cleanUpChangesQueue, 1000)

// function selectionHasChanged (evt) {
//   // const editor = window.activeTextEditor
//   const editor = evt.textEditor
//   const document = editor.document
//
//   const change = {
//     selections: editor.selections,
//     txt: document.getText()
//   }
//
//   changesQueue.unshift(change)
//
//   const opts = {
//     changes: getChangesArray(),
//     prevCursorLine: getPreviousCursorLine(),
//     prevCursorX: getPreviousCursorX()
//   }
//
//   parinfer2.applyParinfer(editor, evt, opts)
// }

function getTextFromRange (txt, range) {
  let firstLine = range.start.line
  let firstChar = range.start.character
  let lastLine = range.end.line
  let lastChar = range.end.character

  let newLines = txt.split('\n')
  let x = 0
  while (x < firstLine) {
    newLines.shift()
    x++
  }
  newLines[0] = newLines[0].substring(firstChar)
  const numLines = lastLine - firstLine + 1
  while (newLines.length > numLines) {
    newLines.pop()
  }
  const lastIdx = newLines.length - 1
  newLines[lastIdx] = newLines[lastIdx].substring(0, lastChar)

  return newLines.join('\n')
}

// console.assert(getTextFromRange('', [{line: 0, character: 0}, {line: 0, character: 0}]) === '')
// console.assert(getTextFromRange('     ', [{line: 0, character: 2}, {line: 0, character: 5}]) === '   ')
// console.assert(getTextFromRange('abcdef', [{line: 0, character: 0}, {line: 0, character: 2}]) === 'ab')
// console.assert(getTextFromRange('abcdef\nabcdef', [{line: 0, character: 3}, {line: 1, character: 3}]) === 'def\nabc')
// console.assert(getTextFromRange('abcdef\nabcdef', [{line: 0, character: 3}, {line: 0, character: 5}]) === 'def')
// console.assert(getTextFromRange('abcdef\nabcdef', [{line: 1, character: 2}, {line: 1, character: 5}]) === 'cdef')
// console.assert(getTextFromRange('abcdef\nabcdef\nabcdef\nabcdef\n', [{line: 3, character: 1}, {line: 1, character: 2}]) === 'cdef\nabcdef\na')

function vscodeChangeToParinferChange (oldTxt, changeEvt) {
  return {
    lineNo: changeEvt.range.start.line,
    newText: changeEvt.text,
    oldText: getTextFromRange(oldTxt, changeEvt.range),
    x: changeEvt.range.start.character
  }
}

function processQueue () {
  if (changesQueue[2]) {
    console.log(changesQueue[2])
  }
  if (changesQueue[1]) {
    console.log(changesQueue[1])
  }
  console.log(changesQueue[0])
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
}

function onChangeTextDocument (evt) {
  // the first event to a document does not contain any changes; drop it
  if (evt.contentChanges && evt.contentChanges.length === 0) {
    return
  }

  let parinferEvent = {
    txt: evt.document.getText(),
    type: 'DOCUMENT_CHANGE'
  }

  // only create a "changes" property if we have a prior event
  if (changesQueue[0] && changesQueue[0].txt) {
    const prevTxt = changesQueue[0].txt
    const convertFn = vscodeChangeToParinferChange.bind(null, prevTxt)
    parinferEvent.changes = evt.contentChanges.map(convertFn)
  }

  changesQueue.unshift(parinferEvent)
}

function onChangeSelection (evt) {
  const editor = evt.textEditor
  const parinferEvent = {
    cursorLine: evt.selections[0].active.line,
    cursorX: evt.selections[0].active.character,
    txt: editor.document.getText(),
    type: 'CURSOR_CHANGE'
  }

  changesQueue.unshift(parinferEvent)
  processQueue()
}

// runs when the extension is activated
function activate (context) {
  // TODO: put the version here
  console.log('vscode-parinfer activated')

  statusBar.initStatusBar('parinfer.toggleMode')

  activatePane(window.activeTextEditor)

  vscode.window.onDidChangeTextEditorSelection(onChangeSelection)
  vscode.workspace.onDidChangeTextDocument(onChangeTextDocument)

  context.subscriptions.push(
    vscode.commands.registerCommand('parinfer.toggleMode', () => {
      toggleMode(window.activeTextEditor)
    }),
    vscode.commands.registerCommand('parinfer.disable', () => {
      parinfer2.disableParinfer(window.activeTextEditor)
    }),
    // window.onDidChangeTextEditorSelection((event) => {
    //   parinfer2.applyParinfer(window.activeTextEditor, event)
    // }),
    // window.onDidChangeTextEditorSelection(onChangeSelection),
    window.onDidChangeActiveTextEditor(activatePane)
  )
}

exports.activate = activate
