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
let ignoreNextEdit = false
let prevCursorLine = null
let prevCursorX = null
let prevTxt = null

const logEventsQueue = true

function processEventsQueue () {
  // do nothing if the queue is empty (this should never happen)
  if (eventsQueue.length === 0) return

  const activeEditor = window.activeTextEditor
  const editorMode = editorStates.deref().get(activeEditor)

  // exit if we are not in Smart, Indent, or Paren mode
  if (!util.isRunState(editorMode)) return

  // current text / previous text
  const currentTxt = eventsQueue[0].txt
  prevTxt = currentTxt

  // cursor options
  let options = {
    cursorLine: eventsQueue[0].cursorLine,
    cursorX: eventsQueue[0].cursorX
  }

  // previous cursor information
  options.prevCursorLine = prevCursorLine
  options.prevCursorX = prevCursorX
  prevCursorLine = options.cursorLine
  prevCursorX = options.cursorX

  // grab the document changes
  let changes = []
  let i = eventsQueue.length - 1
  while (i >= 0) {
    if (eventsQueue[i] &&
        eventsQueue[i].type === documentChangeEvent &&
        eventsQueue[i].changes) {
      changes = changes.concat(eventsQueue[i].changes)
    }
    i = i - 1
  }
  if (changes.length > 0) {
    options.changes = changes
  }

  if (logEventsQueue) {
    // console.log(JSON.stringify(eventsQueue, null, 2))
    console.log('Parinfer options: ' + JSON.stringify(options))
    console.log('~~~~~~~~~~~~~~~~ eventsQueue ~~~~~~~~~~~~~~~~')
  }

  // clear out the event queue and ignore the next edit (since Parinfer will make it)
  // FIXME: set this flag just before making the edit
  // FIXME: we probably need a second flag for the selection change
  //        (assuming that Parinfer changes the cursor)
  eventsQueue.length = 0
  ignoreNextEdit = true
  parinfer2.applyParinfer(activeEditor, currentTxt, options)
}

const debouncedProcessEventsQueue = debounce(processEventsQueue, 1000)

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
  ignoreNextEdit = false
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

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
function repeatString (char, length) {
  let newStr = ''
  for (let i = 0; i < length; i++) {
    newStr = newStr + 'x'
  }
  return newStr
}

// convert TextDocumentChangeEvent to the format Parinfer expects
function convertChangeEvent (change) {
  // const start = {
  //   line: change.range.start.line,
  //   char: change.range.start.character
  // }
  // const end = {
  //   line: change.range.end.line,
  //   char: change.range.end.character
  // }
  // return {
  //   rangeStart: start,
  //   rangeEnd: end,
  //   rangeOffset: change.rangeOffset,
  //   rangeLength: change.rangeLength,
  //   text: change.text
  // }

  return {
    lineNo: change.range.start.line,
    newText: change.text,
    oldText: repeatString('x', change.rangeLength),
    x: change.range.start.character
  }
}

// this function fires any time a document's content is changed
function onChangeTextDocument (evt) {
  // ignore edits that were made by Parinfer
  if (ignoreNextEdit) {
    ignoreNextEdit = false
    return
  }

  // drop any events that do not contain document changes
  // NOTE: this is usually the first change to a document and anytime the user presses "save"
  if (evt.contentChanges && evt.contentChanges.length === 0) {
    return
  }

  const activeEditor = window.activeTextEditor
  const theDocument = evt.document
  let parinferEvent = {
    changes: evt.contentChanges.map(convertChangeEvent),
    cursorLine: activeEditor.selections[0].active.line,
    cursorX: activeEditor.selections[0].active.character,
    documentVersion: theDocument.version,
    txt: theDocument.getText(),
    type: documentChangeEvent
  }

  // console.log(JSON.stringify(parinferEvent.changes, null, 2))
  // console.log('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')

  // only create a "changes" property if there was prior text
  // if (prevTxt) {
  //   const convertFn = convertChangeObjects.bind(null, prevTxt)
  //   parinferEvent.changes = evt.contentChanges.map(convertFn)
  // }

  // put this event on the queue and schedule a processing
  eventsQueue.unshift(parinferEvent)
  debouncedProcessEventsQueue()
}

// this function fires any time a cursor's position changes (ie: often)
// FIXME: make sure to ignore this event if it was caused by Parinfer
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
