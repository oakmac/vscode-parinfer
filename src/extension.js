const vscode = require('vscode')
const window = vscode.window

const statusBar = require('./statusbar')

const editor = require('./editor')
const editorStates = editor.editorStates

const parinfer2 = require('./parinfer')
const util = require('./util')

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const documentChangeEvent = 'DOCUMENT_CHANGE'
const selectionChangeEvent = 'SELECTION_CHANGE'
const fiveSecondsMs = 5 * 1000

// -----------------------------------------------------------------------------
// Events Queue
// -----------------------------------------------------------------------------

// FIXME: the events queue needs to be cleared out when the editor changes
// FIXME: need documentation for how the eventsQueue works
let eventsQueue = []

const eventsQueueMaxLength = 10

function cleanUpEventsQueue () {
  if (eventsQueue.length > eventsQueueMaxLength) {
    eventsQueue.length = eventsQueueMaxLength
  }
}

setInterval(cleanUpEventsQueue, fiveSecondsMs)

function processEventsQueue () {
  // defensive: these should never happen
  if (eventsQueue.length === 0 || eventsQueue.type !== selectionChangeEvent) {
    return
  }

  // FIXME: do nothing here if the events in this queue are not for the current editor
  // another approach: empty the queue when switching editors

  const editor = window.activeTextEditor
  const txt = eventsQueue[0].txt

  // FIXME: need to add selectionStartLine here
  let options = {
    cursorLine: eventsQueue[0].cursorLine,
    cursorX: eventsQueue[0].cursorX
  }

  // check the last two events for previous cursor information
  if (eventsQueue[1] && eventsQueue[1].cursorLine) {
    options.prevCursorLine = eventsQueue[1].cursorLine
    options.prevCursorX = eventsQueue[1].cursorX
  } else if (eventsQueue[2] && eventsQueue[2].cursorLine) {
    options.prevCursorLine = eventsQueue[2].cursorLine
    options.prevCursorX = eventsQueue[2].cursorX
  }

  // "document change" events always fire first followed immediately by a "selection change" event
  // try to grab the changes from the most recent document change event
  if (eventsQueue[1] && eventsQueue[1].type === documentChangeEvent && eventsQueue[1].changes) {
    options.changes = eventsQueue[1].changes
  }

  parinfer2.applyParinfer(editor, txt, options)
}

// -----------------------------------------------------------------------------
// Events
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

// convert VS Code change object to the format Parinfer expects
function convertChangeObjects (oldTxt, changeEvt) {
  return {
    lineNo: changeEvt.range.start.line,
    newText: changeEvt.text,
    oldText: util.getTextFromRange(oldTxt, changeEvt.range, changeEvt.rangeLength),
    x: changeEvt.range.start.character
  }
}

function onChangeTextDocument (evt) {
  // drop any events that do not contain document changes
  // (usually the first event to a document)
  if (evt.contentChanges && evt.contentChanges.length === 0) {
    return
  }

  let parinferEvent = {
    txt: evt.document.getText(),
    type: documentChangeEvent
  }

  // only create a "changes" property if we have a prior event
  if (eventsQueue[0] && eventsQueue[0].txt) {
    const prevTxt = eventsQueue[0].txt
    const convertFn = convertChangeObjects.bind(null, prevTxt)
    parinferEvent.changes = evt.contentChanges.map(convertFn)
  }

  // put this event on the queue
  eventsQueue.unshift(parinferEvent)
}

function onChangeSelection (evt) {
  const editor = evt.textEditor
  const parinferEvent = {
    cursorLine: evt.selections[0].active.line,
    cursorX: evt.selections[0].active.character,
    txt: editor.document.getText(),
    type: selectionChangeEvent
  }

  // put this event on the queue
  eventsQueue.unshift(parinferEvent)

  // process the queue after every "selection change" event
  processEventsQueue()
}

// -----------------------------------------------------------------------------
// Plugin Activation
// -----------------------------------------------------------------------------

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
    window.onDidChangeActiveTextEditor(activatePane)
  )
}

exports.activate = activate
