// -----------------------------------------------------------------------------
// Requires
// -----------------------------------------------------------------------------

const vscode = require('vscode')
const window = vscode.window
const statusBar = require('./statusbar')
const editorModule = require('./editor')
const editorStates = editorModule.editorStates
const parenTrailsModule = require('./parentrails')
const clearParenTrailDecorators = parenTrailsModule.clearParenTrailDecorators
const parinfer2 = require('./parinfer')
const util = require('./util')
const debounce = util.debounce
const config = require('./config')
const path = require('path')
const fs = require('fs')

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const documentChangeEvent = 'DOCUMENT_CHANGE'
const selectionChangeEvent = 'SELECTION_CHANGE'

// -----------------------------------------------------------------------------
// Events Queue
// -----------------------------------------------------------------------------

// TODO: need documentation for how the eventsQueue works
let eventsQueue = []
let prevCursorLine = null
let prevCursorX = null
let prevTxt = null

const logEventsQueue = false

function processEventsQueue () {
  // do nothing if the queue is empty
  if (eventsQueue.length === 0) return

  const activeEditor = window.activeTextEditor
  const editorMode = editorStates.deref().get(activeEditor)

  // exit if we are not in Smart, Indent, or Paren mode
  if (!util.isRunState(editorMode)) return

  if (logEventsQueue) {
    if (eventsQueue[3]) console.log('3: ', eventsQueue[3])
    if (eventsQueue[2]) console.log('2: ', eventsQueue[2])
    if (eventsQueue[1]) console.log('1: ', eventsQueue[1])
    console.log('0: ', eventsQueue[0])
  }

  // current text / previous text
  const currentTxt = eventsQueue[0].txt
  prevTxt = currentTxt

  // cursor options
  let options = {
    cursorLine: eventsQueue[0].cursorLine,
    cursorX: eventsQueue[0].cursorX
  }

  // grab the document changes
  if (eventsQueue[0].type === documentChangeEvent && eventsQueue[0].changes) {
    options.changes = eventsQueue[0].changes
  } else if (eventsQueue[0].type === selectionChangeEvent &&
             eventsQueue[1] &&
             eventsQueue[1].type === documentChangeEvent &&
             eventsQueue[1].changes) {
    options.changes = eventsQueue[1].changes
  }

  // previous cursor information
  options.prevCursorLine = prevCursorLine
  options.prevCursorX = prevCursorX
  prevCursorLine = options.cursorLine
  prevCursorX = options.cursorX

  if (logEventsQueue) {
    console.log('Parinfer options: ' + JSON.stringify(options))
    console.log('~~~~~~~~~~~~~~~~ eventsQueue ~~~~~~~~~~~~~~~~')
  }

  eventsQueue.length = 0
  parinfer2.applyParinfer(activeEditor, currentTxt, options)
}

const debouncedProcessEventsQueue = debounce(processEventsQueue, 5)

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
    } else {
      clearParenTrailDecorators(activeEditor)
    }
  } else {
    statusBar.updateStatusBar(null)
    clearParenTrailDecorators(activeEditor)
  }
}

editorStates.addWatch(onChangeEditorStates)

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

function onChangeActiveEditor (editor) {
  // clear out the state when we switch the active editor
  eventsQueue.length = 0
  prevCursorLine = null
  prevCursorX = null
  prevTxt = null

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

// this function fires any time a document's content is changed
function onChangeTextDocument (evt) {
  // drop any events that do not contain document changes
  // NOTE: this is usually the first change to a document and anytime the user presses "save"
  if (evt.contentChanges && evt.contentChanges.length === 0) {
    return
  }

  const activeEditor = window.activeTextEditor
  const theDocument = evt.document
  let parinferEvent = {
    cursorLine: activeEditor.selections[0].active.line,
    cursorX: activeEditor.selections[0].active.character,
    documentVersion: theDocument.version,
    txt: theDocument.getText(),
    type: documentChangeEvent
  }

  // only create a "changes" property if there was prior text
  if (prevTxt) {
    const convertFn = convertChangeObjects.bind(null, prevTxt)
    parinferEvent.changes = evt.contentChanges.map(convertFn)
  }

  // put this event on the queue and schedule a processing
  eventsQueue.unshift(parinferEvent)
  debouncedProcessEventsQueue()
}

// this function fires any time a cursor's position changes (ie: often)
function onChangeSelection (evt) {
  const editor = evt.textEditor
  const theDocument = editor.document
  const selection = evt.selections[0]
  const parinferEvent = {
    cursorLine: selection.active.line,
    cursorX: selection.active.character,
    documentVersion: theDocument.version,
    txt: theDocument.getText(),
    type: selectionChangeEvent
  }

  // put this event on the queue and schedule a processing
  eventsQueue.unshift(parinferEvent)
  debouncedProcessEventsQueue()
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

function getExtensionVersion (extensionPath) {
  const packageJSONFile = path.join(extensionPath, 'package.json')
  let packageInfo = null
  try {
    packageInfo = JSON.parse(fs.readFileSync(packageJSONFile, 'utf8'))
  } catch (e) {}

  if (packageInfo && packageInfo.version) {
    return packageInfo.version
  } else {
    return null
  }
}

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
function activate (extensionContext) {
  const extensionVersion = getExtensionVersion(extensionContext.extensionPath)
  console.log('vscode-parinfer ' + extensionVersion + ' activated!')

  addEvents(extensionContext)
  statusBar.initStatusBar('parinfer.toggleMode')
  onChangeActiveEditor(window.activeTextEditor)
}

exports.activate = activate
