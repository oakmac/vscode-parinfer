import { window, StatusBarAlignment } from 'vscode'
import { atom } from './utils'

const statusBarItem = atom(null)

function initStatusBar (cmd) {
  const sbItem = window.createStatusBarItem(StatusBarAlignment.Right)

  sbItem.command = cmd
  sbItem.show()

  statusBarItem.update(() => sbItem)
}

const enabledColor = '#fff'
const disabledColor = '#ccc'

function setStatusDisabledIndicator (statusBarItem) {
  statusBarItem.text = '$(code)'
  statusBarItem.color = disabledColor
  statusBarItem.tooltip = 'Parinfer is disabled'
}

function setStatusIndicator (statusBarItem, state) {
  const mode = state === 'indent-mode' ? 'Indent' : 'Paren'
  statusBarItem.text = `$(code) ${mode}`
  statusBarItem.color = enabledColor
  statusBarItem.tooltip = `Parinfer is in ${mode} mode`
}

function updateStatusBar (state) {
  const sbItem = statusBarItem.deref()
  if (typeof state !== 'string') {
    sbItem.hide()
  } else if (state === 'disabled') {
    setStatusDisabledIndicator(sbItem)
    sbItem.show()
  } else {
    setStatusIndicator(sbItem, state)
    sbItem.show()
  }
}

export { initStatusBar, updateStatusBar }
