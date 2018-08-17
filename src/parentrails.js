const vscode = require('vscode')
const Range = vscode.Range
const window = vscode.window
const config = require('./config')

const opacityDecoration = window.createTextEditorDecorationType({
  opacity: '0.4'
})

function parinferRangeToVSCodeRange (parenTrail) {
  return new Range(
    parenTrail.lineNo, parenTrail.startX,
    parenTrail.lineNo, parenTrail.endX
  )
}

function clearParenTrailDecorators (editor) {
  editor.setDecorations(opacityDecoration, [])
}

function dimParenTrails (editor, parenTrails) {
  const parenTrailsRanges = parenTrails.map(parinferRangeToVSCodeRange)
  editor.setDecorations(opacityDecoration, parenTrailsRanges)
}

function updateParenTrails (mode, editor, parenTrails) {
  if (config.dimParenTrails && (mode === 'SMART_MODE' || mode === 'INDENT_MODE')) {
    dimParenTrails(editor, parenTrails)
  } else {
    clearParenTrailDecorators(editor)
  }
}

exports.clearParenTrailDecorators = clearParenTrailDecorators
exports.updateParenTrails = updateParenTrails
