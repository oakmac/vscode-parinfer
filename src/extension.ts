import { commands, window } from 'vscode'
import { initStatusBar, updateStatusBar } from './statusbar'
import { editorStates } from './editor'
import { disableParinfer, applyParinfer, parinfer } from './parinfer'

editorStates.addWatch((states) => {
  const editor = window.activeTextEditor
  const currentEditorState = states.get(editor)

  if (editor && currentEditorState) {
    updateStatusBar(currentEditorState)
    if (currentEditorState === 'indent-mode' || currentEditorState === 'paren-mode') {
      applyParinfer(editor)
    }
  } else if (editor) {
    updateStatusBar()
  }
})

function toggleMode (editor) {
  editorStates.update((states) => {
    const nextState = states.get(editor) === 'paren-mode' ? 'indent-mode' : 'paren-mode'
    return states.set(editor, nextState)
  })
}

function activatePane (editor) {
  if (editor) {
    parinfer(editor)
  }
}

export function activate (context) {
  // TODO: put the version here
  console.log('vscode-parinfer activated')

  initStatusBar('parinfer.toggleMode')

  activatePane(window.activeTextEditor)

  context.subscriptions.push(
    commands.registerCommand('parinfer.toggleMode', () => {
      toggleMode(window.activeTextEditor)
    }),
    commands.registerCommand('parinfer.disable', () => {
      disableParinfer(window.activeTextEditor)
    }),
    window.onDidChangeTextEditorSelection((event) => {
      applyParinfer(window.activeTextEditor, event)
    }),
    window.onDidChangeActiveTextEditor(activatePane)
  )
}
