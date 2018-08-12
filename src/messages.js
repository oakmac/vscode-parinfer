const config = require('./config')

function parenModeFailedMsg (currentFile) {
  const activeMode = config.useSmartMode ? 'Smart Mode' : 'Indent Mode'

  return (
    'Parinfer was unable to parse ' + currentFile + ' ' +
    'It is likely that this file has unbalanced parentheses and will not compile. ' +
    'Parinfer will enter Paren Mode so you may fix the problem. ' +
    'Press Ctrl + ( to switch to ' + activeMode + ' once the file is balanced.'
  )
}

function parenModeChangedFileMsg (currentFile, diff) {
  const activeMode = config.useSmartMode ? 'Smart Mode' : 'Indent Mode'
  const lines = (diff === 1 ? 'line' : 'lines')

  return (
    'Parinfer needs to make some changes to ' + currentFile + ' before enabling ' + activeMode + '. ' +
    'These changes will only affect whitespace and indentation; the structure of the file will be unchanged. ' +
    diff + ' ' + lines + ' will be affected. ' +
    'Would you like Parinfer to modify the file? (recommended)'
  )
}

exports.parenModeFailedMsg = parenModeFailedMsg
exports.parenModeChangedFileMsg = parenModeChangedFileMsg
