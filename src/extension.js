const vscode = require('vscode')
const window = vscode.window

const statusBar = require('./statusbar')

const editorModule = require('./editor')
const editorStates = editorModule.editorStates

const parinfer2 = require('./parinfer')
const util = require('./util')

const config = require('./config')

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// TODO: how to pull this from the package.json file directly?
const version = '0.6.1'
const documentChangeEvent = 'DOCUMENT_CHANGE'
const selectionChangeEvent = 'SELECTION_CHANGE'
const fiveSecondsMs = 5 * 1000

// -----------------------------------------------------------------------------
// Events Queue
// -----------------------------------------------------------------------------

// TODO: need documentation for how the eventsQueue works
let eventsQueue = []

const eventsQueueMaxLength = 10

function cleanUpEventsQueue () {
  if (eventsQueue.length > eventsQueueMaxLength) {
    eventsQueue.length = eventsQueueMaxLength
  }
}

setInterval(cleanUpEventsQueue, fiveSecondsMs)

const logEventsQueue = false

function processEventsQueue () {
  // defensive: these should never happen
  if (eventsQueue.length === 0) return
  if (eventsQueue[0].type !== selectionChangeEvent) return

  if (logEventsQueue) {
    if (eventsQueue[2]) console.log('2: ', eventsQueue[2])
    if (eventsQueue[1]) console.log('1: ', eventsQueue[1])
    console.log('0: ', eventsQueue[0])
    console.log('~~~~~~~~~~~~~~~~ eventsQueue ~~~~~~~~~~~~~~~~')
  }

  const activeEditor = window.activeTextEditor
  const txt = eventsQueue[0].txt

  // cursor options
  let options = {
    cursorLine: eventsQueue[0].cursorLine,
    cursorX: eventsQueue[0].cursorX
  }

  // TODO: this is not working correctly
  // // add selectionStartLine if applicable
  // if (eventsQueue[0].selectionStartLine) {
  //   options.selectionStartLine = eventsQueue[0].selectionStartLine
  // }

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

  parinfer2.applyParinfer(activeEditor, txt, options)
}

// -----------------------------------------------------------------------------
// Change Editor State
// -----------------------------------------------------------------------------

function onChangeEditorStates (states) {
  const activeEditor = window.activeTextEditor

  // defensive
  if (!activeEditor) return

  const currentEditorState = states.get(activeEditor)

  if (currentEditorState) {
    statusBar.updateStatusBar(currentEditorState)
    if (util.isRunState(currentEditorState)) {
      const txt = activeEditor.document.getText()
      parinfer2.applyParinfer(activeEditor, txt, {})
    }
  } else {
    statusBar.updateStatusBar(null)
  }
}

editorStates.addWatch(onChangeEditorStates)

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

function onChangeActiveEditor (editor) {
  // clear out the eventsQueue when we switch editor tabs
  eventsQueue = []

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
  const selection = evt.selections[0]
  let parinferEvent = {
    cursorLine: selection.active.line,
    cursorX: selection.active.character,
    txt: editor.document.getText(),
    type: selectionChangeEvent
  }

  // TODO: this is not working correctly
  // // add selectionStartLine if applicable
  // if (selection && !selection.isEmpty) {
  //   parinferEvent.selectionStartLine = selection.start.line
  // }

  // put this event on the queue
  eventsQueue.unshift(parinferEvent)

  // process the queue after every "selection change" event
  processEventsQueue()
}

// -----------------------------------------------------------------------------
// Plugin Commands
// -----------------------------------------------------------------------------

function disableParinfer (activeEditor) {
  editorStates.update(function (states) {
    return states.set(activeEditor, 'DISABLED')
  })
}

function toggleMode (activeEditor) {
  editorStates.update(function (states) {
    const currentState = states.get(activeEditor)

    let nextState = 'PAREN_MODE'
    if (currentState === 'DISABLED' || currentState === 'PAREN_MODE') {
      nextState = 'INDENT_MODE'
    }

    if (nextState === 'INDENT_MODE' && config.useSmartMode) {
      nextState = 'SMART_MODE'
    }

    return states.set(activeEditor, nextState)
  })
}

// -----------------------------------------------------------------------------
// Plugin Activation
// -----------------------------------------------------------------------------

function addEvents (context) {
  vscode.window.onDidChangeActiveTextEditor(onChangeActiveEditor)
  vscode.window.onDidChangeTextEditorSelection(onChangeSelection)
  vscode.workspace.onDidChangeTextDocument(onChangeTextDocument)

  context.subscriptions.push(
    vscode.commands.registerCommand('parinfer.toggleMode', () => {
      toggleMode(window.activeTextEditor)
    }),
    vscode.commands.registerCommand('parinfer.disable', () => {
      disableParinfer(window.activeTextEditor)
    })
  )
}

// runs when the extension is activated
function activate (context) {
  console.log('vscode-parinfer ' + version + ' activated!')

  addEvents(context)
  statusBar.initStatusBar('parinfer.toggleMode')
  onChangeActiveEditor(window.activeTextEditor)
}

exports.activate = activate
