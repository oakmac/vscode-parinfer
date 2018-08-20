/* global describe, it */

const assert = require('assert')
const util = require('../src/util.js')

// -----------------------------------------------------------------------------
// Util
// -----------------------------------------------------------------------------

const change1a = {
  lineNo: 1,
  newText: 'a',
  oldText: '',
  x: 3
}

const change1b = {
  lineNo: 1,
  newText: 'bc',
  oldText: '',
  x: 4
}

const joinedChanged1 = {
  lineNo: 1,
  newText: 'abc',
  oldText: '',
  x: 3
}

const change2a = {
  lineNo: 0,
  newText: 'abc',
  oldText: '',
  x: 0
}

const change2b = {
  lineNo: 0,
  newText: 'x',
  oldText: 'c',
  x: 2
}

const joinedChanged2 = {
  lineNo: 0,
  newText: 'abx',
  oldText: '',
  x: 0
}

const change3a = {
  lineNo: 0,
  newText: 'abc',
  oldText: '',
  x: 1
}

const change3b = {
  lineNo: 0,
  newText: 'xyzxyz',
  oldText: 'abc',
  x: 1
}

const joinedChanged3 = {
  lineNo: 0,
  newText: 'xyzxyz',
  oldText: '',
  x: 1
}

const change4a = {
  lineNo: 0,
  newText: '',
  oldText: 'c',
  x: 2
}

const change4b = {
  lineNo: 0,
  newText: '',
  oldText: 'b',
  x: 1
}

const joinedChanged4 = {
  lineNo: 0,
  newText: '',
  oldText: 'bc',
  x: 1
}

const change5a = {
  lineNo: 0,
  newText: 'pear\npeach',
  oldText: 'strawberry pineapple\nbanana raspberry',
  x: 1
}

const change5b = {
  lineNo: 1,
  newText: 'orange',
  oldText: 'peach',
  x: 0
}

const joinedChanged5 = {
  lineNo: 0,
  newText: 'pear\norange',
  oldText: 'strawberry pineapple\nbanana raspberry',
  x: 1
}

function testUtil () {
  it('joinChanges 1', function () {
    assert.deepStrictEqual(util.joinChanges(change1a, change1b), joinedChanged1)
  })

  it('joinChanges 2', function () {
    assert.deepStrictEqual(util.joinChanges(change2a, change2b), joinedChanged2)
  })

  it('joinChanges 3', function () {
    assert.deepStrictEqual(util.joinChanges(change3a, change3b), joinedChanged3)
  })

  it('joinChanges 4', function () {
    assert.deepStrictEqual(util.joinChanges(change4a, change4b), joinedChanged4)
  })

  it('joinChanges 5', function () {
    assert.deepStrictEqual(util.joinChanges(change5a, change5b), joinedChanged5)
  })
}

describe('util.js tests', testUtil)
