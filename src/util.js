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

function replaceWithinString(orig, start, end, replace) {
  return (
    orig.substring(0, start) +
    replace +
    orig.substring(end)
  );
}

function joinChanges_OLD (change1, change2) {
  let newChange = {
    lineNo: change1.lineNo,
    oldText: change1.oldText,
    x: change1.x
  }

  // const minX = Math.min(change1.x, change2.x)
  // const maxX = Math.max(change1.x + change1.newText.length, change2.x + change2.newText.length)
  //
  // const line1 = []
  // const line2 = []

  // change2 is either 1) an insert 2) a delete or 3) replace
  const isInsertOrReplace = change2.newText.length >= change2.oldText.length
  const isDelete = change2.newText.length < change2.oldText.length

  if (isInsertOrReplace) {
    const startIdx = change2.x - change1.x
    const changeLength = change2.newText.length
    const endIdx = startIdx + changeLength
    newChange.newText = replaceWithinString(change1.newText, startIdx, endIdx, change2.newText)
  } else if (isDelete) {
    //newChange.
  }

  return newChange
}

function joinChanges (change1, change2) {
  const minX = Math.min(change1.x, change2.x)
  const maxX = Math.max(change1.x + change1.oldText.length, change1.x + change1.newText.length,
                        change2.x + change2.oldText.length, change2.x + change2.newText.length)
  const arrSize = maxX - minX


  // const minX = Math.min(change1.x, change2.x)
  // const maxX = Math.max(change1.x + change1.newText.length, change2.x + change2.newText.length)
  //
  // const line1 = []
  // const line2 = []

  // change2 is either 1) an insert 2) a delete or 3) replace
  const isInsertOrReplace = change2.newText.length >= change2.oldText.length
  const isDelete = change2.newText.length < change2.oldText.length

  if (isInsertOrReplace) {
    const startIdx = change2.x - change1.x
    const changeLength = change2.newText.length
    const endIdx = startIdx + changeLength
    newChange.newText = replaceWithinString(change1.newText, startIdx, endIdx, change2.newText)
  } else if (isDelete) {

  }

  return newChange
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
