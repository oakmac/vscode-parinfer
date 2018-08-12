const vscode = require('vscode')
const workspace = vscode.workspace

exports.useSmartMode = workspace.getConfiguration('parinfer').get('useSmartMode')
