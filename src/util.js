function isString (s) {
  return typeof s === 'string'
}

function atom (val) {
  let watchers = []
  const notify = () => watchers.forEach((f) => f(val))

  return {
    update: (fn) => {
      val = fn(val)
      notify()
    },
    addWatch: (fn) => {
      watchers.push(fn)
    },
    removeWatch: (fn) => {
      watchers = watchers.filter((f) => f !== fn)
    },
    deref: () => val
  }
}

function map (fn, ...xs) {
  let result = []
  let idx = 0
  const ln = xs[0].length

  while (idx < ln) {
    result.push(fn(...xs.map((item) => item[idx])))
    idx++
  }

  return result
}

function splitLines (text) {
  return text.split(/\n/)
}

function isParentExprLine (line) {
  return isString(line) && line.match(/^\([a-zA-Z]/) !== null
}

function findStartRow (lines, idx) {
  if (idx === 0) {
    return 0
  }

  let cidx = idx - 1
  let cango = true
  while (cango) {
    if (cidx === 0 || isParentExprLine(lines[cidx] || false)) {
      cango = false
    } else {
      cidx = cidx - 1
    }
  }
  return cidx
}

function findEndRow (lines, idx) {
  const cp1 = idx + 1
  const cp2 = cp1 + 1
  const midx = lines.length - 1

  if (midx === idx ||
      midx === cp1 ||
      midx === cp2) {
    return midx
  }

  let cidx = cp2
  let cango = true
  while (cango) {
    if (cidx === midx || isParentExprLine(lines[cidx] || false)) {
      cango = false
    } else {
      cidx = cidx + 1
    }
  }
  return cidx
}

function linesDiff (textA, textB) {
  const splitA = splitLines(textA)
  const splitB = splitLines(textB)
  const splitBoth = map((...splits) => splits, splitA, splitB)
  const initialCount = { diff: 0, same: 0 }

  return splitBoth.reduce((count, [lineA, lineB]) => {
    if (lineA === lineB) {
      count.same = count.same + 1
    } else {
      count.diff = count.diff + 1
    }
    return count
  }, initialCount)
}

function getTextFromRange (txt, range, length) {
  if (length === 0) return ''

  let firstLine = range.start.line
  let firstChar = range.start.character

  const lines = txt.split('\n')
  const line = lines[firstLine]

  return line.substring(firstChar, firstChar + length)
}

exports.atom = atom
exports.findEndRow = findEndRow
exports.findStartRow = findStartRow
exports.getTextFromRange = getTextFromRange
exports.isParentExprLine = isParentExprLine
exports.isString = isString
exports.linesDiff = linesDiff
exports.map = map
exports.splitLines = splitLines
