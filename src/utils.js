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

function debounce (fn, interval) {
  let tid
  return (...args) => {
    clearTimeout(tid)
    tid = setTimeout(() => fn(...args), interval)
  }
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

function getTextFromRange (txt, range) {
  let firstLine = range.start.line
  let firstChar = range.start.character
  let lastLine = range.end.line
  let lastChar = range.end.character

  let newLines = txt.split('\n')
  let x = 0
  while (x < firstLine) {
    newLines.shift()
    x++
  }
  newLines[0] = newLines[0].substring(firstChar)
  const numLines = lastLine - firstLine + 1
  while (newLines.length > numLines) {
    newLines.pop()
  }
  const lastIdx = newLines.length - 1
  newLines[lastIdx] = newLines[lastIdx].substring(0, lastChar)

  return newLines.join('\n')
}

// console.assert(getTextFromRange('', [{line: 0, character: 0}, {line: 0, character: 0}]) === '')
// console.assert(getTextFromRange('     ', [{line: 0, character: 2}, {line: 0, character: 5}]) === '   ')
// console.assert(getTextFromRange('abcdef', [{line: 0, character: 0}, {line: 0, character: 2}]) === 'ab')
// console.assert(getTextFromRange('abcdef\nabcdef', [{line: 0, character: 3}, {line: 1, character: 3}]) === 'def\nabc')
// console.assert(getTextFromRange('abcdef\nabcdef', [{line: 0, character: 3}, {line: 0, character: 5}]) === 'def')
// console.assert(getTextFromRange('abcdef\nabcdef', [{line: 1, character: 2}, {line: 1, character: 5}]) === 'cdef')
// console.assert(getTextFromRange('abcdef\nabcdef\nabcdef\nabcdef\n', [{line: 3, character: 1}, {line: 1, character: 2}]) === 'cdef\nabcdef\na')

exports.atom = atom
exports.debounce = debounce
exports.findEndRow = findEndRow
exports.findStartRow = findStartRow
exports.getTextFromRange = getTextFromRange
exports.isParentExprLine = isParentExprLine
exports.isString = isString
exports.linesDiff = linesDiff
exports.map = map
exports.splitLines = splitLines
