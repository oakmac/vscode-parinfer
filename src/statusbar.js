const vscode = require('vscode')
const window = vscode.window
const StatusBarAlignment = vscode.StatusBarAlignment

const util = require('./utils')
const atom = util.atom
const isString = util.isString

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
  let modeTxt = ''
  if (state === 'INDENT_MODE') modeTxt = 'Indent'
  else if (state === 'SMART_MODE') modeTxt = 'Smart'
  else if (state === 'PAREN_MODE') modeTxt = 'Paren'

  statusBarItem.text = `$(code) ${modeTxt}`
  statusBarItem.color = enabledColor
  statusBarItem.tooltip = `Parinfer is in ${modeTxt} mode`
}

function updateStatusBar (state) {
  const sbItem = statusBarItem.deref()
  if (!isString(state)) {
    sbItem.hide()
  } else if (state === 'DISABLED') {
    setStatusDisabledIndicator(sbItem)
    sbItem.show()
  } else {
    setStatusIndicator(sbItem, state)
    sbItem.show()
  }
}

exports.initStatusBar = initStatusBar
exports.updateStatusBar = updateStatusBar
