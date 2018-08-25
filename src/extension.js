// -----------------------------------------------------------------------------
// Requires
// -----------------------------------------------------------------------------

const diff = require('diff')
const fs = require('fs')
const vscode = require('vscode')
const window = vscode.window
const statusBar = require('./statusbar')
const editorModule = require('./editor')
const editorStates = editorModule.editorStates
const parenTrailsModule = require('./parentrails')
const clearParenTrailDecorators = parenTrailsModule.clearParenTrailDecorators
const parinfer2 = require('./parinfer')
const config = require('./config')
const path = require('path')
const state = require('./state')
const util = require('./util')
const isString = util.isString
const debounce = util.debounce

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

const logEventsQueue = false
const logTextChange = false

function processEventsQueue () {
  // do nothing if the queue is empty (this should never happen)
  if (eventsQueue.length === 0) return

  const activeEditor = window.activeTextEditor
  const editorMode = editorStates.deref().get(activeEditor)

  // exit if we are not in Smart, Indent, or Paren mode
  if (!util.isRunState(editorMode)) return

  // create the Parinfer options object
  let options = {
    cursorLine: eventsQueue[0].cursorLine,
    cursorX: eventsQueue[0].cursorX
  }

  // text + changes
  const currentTxt = eventsQueue[0].txt
  const didTextChange = currentTxt !== state.prevTxt

  if (logTextChange && didTextChange) {
    console.log(state.prevTxt)
    console.log('+++')
    console.log(currentTxt)
    console.log('~~~~~~~~~~~~~~~~ prev / current text ~~~~~~~~~~~~~~~~')
  }

  options.changes = null
  if (isString(state.prevTxt) && didTextChange) {
    options.changes = calculateChanges(state.prevTxt, currentTxt)
  }

  // previous cursor information
  options.prevCursorLine = prevCursorLine
  options.prevCursorX = prevCursorX
  prevCursorLine = options.cursorLine
  prevCursorX = options.cursorX

  if (logEventsQueue) {
    console.log(JSON.stringify(eventsQueue, null, 2))
    console.log('Parinfer options: ' + JSON.stringify(options))
    console.log('~~~~~~~~~~~~~~~~ eventsQueue ~~~~~~~~~~~~~~~~')
  }

  // clear out the event queue
  eventsQueue.length = 0
  parinfer2.applyParinfer(activeEditor, currentTxt, options)
}

const processQueueDebounceIntervalMs = 20
const debouncedProcessEventsQueue = debounce(processEventsQueue, processQueueDebounceIntervalMs)

function calculateChanges (oldTxt, newTxt) {
  const theDiff = diff.diffChars(oldTxt, newTxt)
  return util.diffChangesToParinferChanges(theDiff)
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
      const options = {
        cursorLine: activeEditor.selection.active.line,
        cursorX: activeEditor.selection.active.character
      }
      parinfer2.applyParinfer(activeEditor, txt, options)
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
  state.ignoreDocumentVersion = null
  prevCursorLine = null
  prevCursorX = null
  state.prevTxt = editor.document.getText()

  if (editor) {
    parinfer2.helloEditor(editor)
  }
}

// this function fires any time a document's content is changed
function onChangeTextDocument (evt) {
  // drop any events that do not contain document changes
  // NOTE: this is usually the first change to a document and anytime the user presses "save"
  if (evt.contentChanges && evt.contentChanges.length === 0) {
    return
  }

  // ignore edits that were made by Parinfer
  if (state.ignoreDocumentVersion === evt.document.version) {
    return
  }

  const activeEditor = window.activeTextEditor
  let parinferEvent = {
    cursorLine: activeEditor.selection.active.line,
    cursorX: activeEditor.selection.active.character,
    documentVersion: evt.document.version,
    txt: evt.document.getText(),
    type: documentChangeEvent
  }

  // put this event on the queue and schedule a processing
  eventsQueue.unshift(parinferEvent)
  debouncedProcessEventsQueue()
}

// this function fires any time a cursor's position changes (ie: often)
function onChangeSelection (evt) {
  // TODO: ignore events that were not made by a mouse or keyboard?

  const editor = evt.textEditor
  const parinferEvent = {
    cursorLine: editor.selection.active.line,
    cursorX: editor.selection.active.character,
    documentVersion: editor.document.version,
    txt: editor.document.getText(),
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
