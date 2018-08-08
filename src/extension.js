const vscode = require('vscode')
const window = vscode.window

const statusBar = require('./statusbar')
const initStatusBar = statusBar.initStatusBar
const updateStatusBar = statusBar.updateStatusBar

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
    updateStatusBar(currentEditorState)
    if (currentEditorState === 'INDENT_MODE' || currentEditorState === 'PAREN_MODE') {
      parinfer2.applyParinfer(editor, null)
    }
  } else if (editor) {
    updateStatusBar(null)
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

let changesQueue = []

function selectionHasChanged (evt) {
  const editor = window.activeTextEditor
  const document = editor.document
  // const txt = document.getText()
  // const selections = editor.selections

  const change = {
    selections: editor.selections,
    txt: document.getText()
  }

  changesQueue.unshift(change)

  // console.log(changesQueue)
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
}

// runs when the extension is activated
function activate (context) {
  // TODO: put the version here
  console.log('vscode-parinfer activated')

  initStatusBar('parinfer.toggleMode')

  activatePane(window.activeTextEditor)

  context.subscriptions.push(
    vscode.commands.registerCommand('parinfer.toggleMode', () => {
      toggleMode(window.activeTextEditor)
    }),
    vscode.commands.registerCommand('parinfer.disable', () => {
      parinfer2.disableParinfer(window.activeTextEditor)
    }),
    window.onDidChangeTextEditorSelection((event) => {
      parinfer2.applyParinfer(window.activeTextEditor, event)
    }),
    window.onDidChangeTextEditorSelection(selectionHasChanged),
    window.onDidChangeActiveTextEditor(activatePane)
  )
}

exports.activate = activate
