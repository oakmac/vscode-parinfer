function isString (s) {
  return typeof s === 'string'
}

// https://tinyurl.com/y7paps66
function debounce (fn, interval) {
  let timeout = 0
  return function () {
    clearTimeout(timeout)
    const args = arguments
    timeout = setTimeout(function () {
      fn.apply(null, args)
    }, interval)
  }
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

// FIXME: almost certainly this function has a bug - does multiline work?
function getTextFromRange (txt, range, length) {
  if (length === 0) return ''

  let firstLine = range.start.line
  let firstChar = range.start.character

  const lines = txt.split('\n')
  const line = lines[firstLine]

  return line.substring(firstChar, firstChar + length)
}

function replaceWithinString (orig, start, end, replace) {
  return (
    orig.substring(0, start) +
    replace +
    orig.substring(end)
  )
}

const LINE_ENDING_REGEX = /\r?\n/

function changeType (change) {
  if (change.text.length >= change.changeLength) {
    return 'insert'
  } else {
    return 'delete'
  }
}

function joinMultiLineChange (change1, change2) {
  // TODO: write this
  return null
}

function joinSingleLineDeleteDelete (change1, change2) {
  const minX = Math.min(change1.x, change2.x)
  const maxX = Math.max(change1.x + change1.changeLength, change2.x + change2.changeLength)

  return {
    changeLength: maxX - minX,
    lineNo: change1.lineNo,
    text: '',
    x: change2.x
  }
}

function joinSingleLineDeleteInsert (change1, change2) {
  // TODO: write me
  return null
}

function joinSingleLineInsertDelete (change1, change2) {
  // TODO: write me
  return null
}

function joinSingleLineInsertInsert (change1, change2) {
  const startIdx = change2.x - change1.x
  const endIdx = startIdx + change2.changeLength
  return {
    changeLength: 0,
    lineNo: change1.lineNo,
    text: replaceWithinString(change1.text, startIdx, endIdx, change2.text),
    x: change1.x
  }
}

function joinSingleLineChange (change1, change2) {
  const change1Type = changeType(change1)
  const change2Type = changeType(change2)

  // four possible combinations:
  // insert + insert
  // insert + delete
  // delete + insert
  // delete + delete
  if (change1Type === 'insert' && change2Type === 'insert') {
    return joinSingleLineInsertInsert(change1, change2)
  } else if (change1Type === 'insert' && change2Type === 'delete') {
    return joinSingleLineInsertDelete(change1, change2)
  } else if (change1Type === 'delete' && change2Type === 'insert') {
    return joinSingleLineDeleteInsert(change1, change2)
  } else if (change1Type === 'delete' && change2Type === 'delete') {
    return joinSingleLineDeleteDelete(change1, change2)
  }
}

// NOTES:
// - Shaun says that changes must be contiguous
// - We need a predicate function to check that two changes are contiguous
// - Get one-line changes working first, then tackle multi-line
function joinChanges (change1, change2) {
  const change1Lines = change1.text.split(LINE_ENDING_REGEX)
  const change2Lines = change2.text.split(LINE_ENDING_REGEX)
  const isMultiLineChange = change1.lineNo !== change2.lineNo ||
                            change1Lines.length > 1 ||
                            change2Lines.length > 1

  if (isMultiLineChange) {
    return joinMultiLineChange(change1, change2)
  } else {
    return joinSingleLineChange(change1, change2)
  }
}

function diffChangesToParinferChanges (changes) {

}

function isRunState (state) {
  return state === 'INDENT_MODE' ||
         state === 'SMART_MODE' ||
         state === 'PAREN_MODE'
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

exports.atom = atom
exports.debounce = debounce
exports.diffChangesToParinferChanges = diffChangesToParinferChanges
exports.findEndRow = findEndRow
exports.findStartRow = findStartRow
exports.getTextFromRange = getTextFromRange
exports.isParentExprLine = isParentExprLine
exports.isRunState = isRunState
exports.isString = isString
exports.joinChanges = joinChanges
exports.linesDiff = linesDiff
exports.map = map
exports.splitLines = splitLines
