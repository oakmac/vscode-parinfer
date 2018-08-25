/* global describe, it */

const assert = require('assert')
const util = require('../src/util.js')

// -----------------------------------------------------------------------------
// joinChanges
// -----------------------------------------------------------------------------

function isChangeObject (obj) {
  return obj.hasOwnProperty('changeLength') && typeof obj.changeLength === 'number' &&
         obj.hasOwnProperty('lineNo') && typeof obj.lineNo === 'number' &&
         obj.hasOwnProperty('text') && typeof obj.text === 'string' &&
         obj.hasOwnProperty('x') && typeof obj.x === 'number'
}

const changeExamples = [
  {
    description: 'two basic inserts',
    change1: {
      changeLength: 0,
      lineNo: 1,
      text: 'a',
      x: 3
    },
    change2: {
      changeLength: 0,
      lineNo: 1,
      text: 'bc',
      x: 4
    },
    result: {
      changeLength: 0,
      lineNo: 1,
      text: 'abc',
      x: 3
    }
  },
  {
    description: 'basic insert and a replace',
    change1: {
      changeLength: 0,
      lineNo: 0,
      text: 'abc',
      x: 0
    },
    change2: {
      changeLength: 1,
      lineNo: 0,
      text: 'z',
      x: 2
    },
    result: {
      changeLength: 0,
      lineNo: 0,
      text: 'abz',
      x: 0
    }
  },
  {
    description: 'insert, then insert beyond first range',
    change1: {
      changeLength: 0,
      lineNo: 0,
      text: 'abc',
      x: 1
    },
    change2: {
      changeLength: 3,
      lineNo: 0,
      text: 'xyzxyz',
      x: 1
    },
    result: {
      changeLength: 0,
      lineNo: 0,
      text: 'xyzxyz',
      x: 1
    }
  },
  {
    description: 'two simple deletes',
    change1: {
      changeLength: 1,
      lineNo: 0,
      text: '',
      x: 2
    },
    change2: {
      changeLength: 1,
      lineNo: 0,
      text: '',
      x: 1
    },
    result: {
      changeLength: 2,
      lineNo: 0,
      text: '',
      x: 1
    }
  },
  {
    description: 'longer deletes',
    change1: {
      changeLength: 4,
      lineNo: 2,
      text: '',
      x: 4
    },
    change2: {
      changeLength: 3,
      lineNo: 2,
      text: '',
      x: 1
    },
    result: {
      changeLength: 7,
      lineNo: 2,
      text: '',
      x: 1
    }
  }
  // FIXME: need more test cases here
  // In particular: need multi-line
]

// const change5a = {
//   lineNo: 0,
//   text: 'pear\npeach',
//   oldText: 'strawberry pineapple\nbanana raspberry',
//   x: 1
// }
//
// const change5b = {
//   lineNo: 1,
//   text: 'orange',
//   oldText: 'peach',
//   x: 0
// }
//
// const joinedChanged5 = {
//   lineNo: 0,
//   text: 'pear\norange',
//   oldText: 'strawberry pineapple\nbanana raspberry',
//   x: 1
// }

function testJoinChanges () {
  changeExamples.forEach(function (itm) {
    it(itm.description, function () {
      assert.ok(isChangeObject(itm.change1), '"change1" object is formatted wrong for test "' + itm.description + '"')
      assert.ok(isChangeObject(itm.change2), '"change2" object is formatted wrong for test "' + itm.description + '"')
      assert.ok(isChangeObject(itm.result), '"result" object is formatted wrong for test "' + itm.description + '"')
      assert.deepStrictEqual(util.joinChanges(itm.change1, itm.change2), itm.result)
    })
  })
}

describe('joinChanges', testJoinChanges)

// -----------------------------------------------------------------------------
// diff changes
// -----------------------------------------------------------------------------

const diffExamples = [
  {
    description: 'basic insert',
    diff: [
      {
        count: 4,
        value: '(foo'
      },
      {
        count: 3,
        added: true,
        value: 'bar'
      },
      {
        count: 10,
        value: ' [1 2 3])'
      }
    ],
    parinfer: [
      {
        lineNo: 0,
        newText: 'bar',
        oldText: '',
        x: 4
      }
    ]
  }

  // FIXME: need more test cases here
  // In particular: need multi-line
]

function testDiffChanges () {
  diffExamples.forEach(function (itm) {
    it(itm.description, function () {
      assert.deepStrictEqual(util.diffChangesToParinferChanges(itm.diff), itm.parinfer)
    })
  })
}

describe('diff changes', testDiffChanges)
