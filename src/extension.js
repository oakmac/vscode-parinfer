const vscode = require('vscode')
const window = vscode.window

const statusBar = require('./statusbar')

const editor = require('./editor')
const editorStates = editor.editorStates

const parinfer2 = require('./parinfer')
const utils = require('./utils')
const getTextFromRange = utils.getTextFromRange

// -----------------------------------------------------------------------------
// Activate
// -----------------------------------------------------------------------------

function onChangeEditorStates (states) {
  const editor = window.activeTextEditor
  const currentEditorState = states.get(editor)

  if (editor && currentEditorState) {
    statusBar.updateStatusBar(currentEditorState)
    if (currentEditorState === 'INDENT_MODE' || currentEditorState === 'PAREN_MODE') {
      const txt = editor.document.getText()
      parinfer2.applyParinfer(editor, txt, {})
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
let eventQueue = []

function cleanUpChangesQueue () {
  if (eventQueue.length > 10) {
    eventQueue.length = 10
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
//   eventQueue.unshift(change)
//
//   const opts = {
//     changes: getChangesArray(),
//     prevCursorLine: getPreviousCursorLine(),
//     prevCursorX: getPreviousCursorX()
//   }
//
//   parinfer2.applyParinfer(editor, evt, opts)
// }

function vscodeChangeToParinferChange (oldTxt, changeEvt) {
  return {
    lineNo: changeEvt.range.start.line,
    newText: changeEvt.text,
    oldText: getTextFromRange(oldTxt, changeEvt.range),
    x: changeEvt.range.start.character
  }
}

function processEventQueue () {
  // defensive: this should never happen
  if (eventQueue.length === 0) return

  // if (eventQueue[2]) {
  //   console.log(eventQueue[2])
  // }
  // if (eventQueue[1]) {
  //   console.log(eventQueue[1])
  // }
  // console.log(eventQueue[0])
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')

  const editor = window.activeTextEditor
  const txt = eventQueue[0].txt

  let options = {
    cursorLine: eventQueue[0].cursorLine,
    cursorX: eventQueue[0].cursorX
  }

  // previous cursor
  if (eventQueue[1] && eventQueue[1].cursorLine) {
    options.prevCursorLine = eventQueue[1].cursorLine
    options.prevCursorX = eventQueue[1].cursorX
  } else if (eventQueue[2] && eventQueue[2].cursorLine) {
    options.prevCursorLine = eventQueue[2].cursorLine
    options.prevCursorX = eventQueue[2].cursorX
  }

  // changes
  if (eventQueue[1] && eventQueue[1].type === 'DOCUMENT_CHANGE' && eventQueue[1].changes) {
    options.changes = eventQueue[1].changes
  }

  // console.log(options)

  parinfer2.applyParinfer(editor, txt, options)
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
  if (eventQueue[0] && eventQueue[0].txt) {
    const prevTxt = eventQueue[0].txt
    const convertFn = vscodeChangeToParinferChange.bind(null, prevTxt)
    parinferEvent.changes = evt.contentChanges.map(convertFn)
  }

  eventQueue.unshift(parinferEvent)
}

function onChangeSelection (evt) {
  const editor = evt.textEditor
  const parinferEvent = {
    cursorLine: evt.selections[0].active.line,
    cursorX: evt.selections[0].active.character,
    txt: editor.document.getText(),
    type: 'CURSOR_CHANGE'
  }

  eventQueue.unshift(parinferEvent)
  processEventQueue()
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
