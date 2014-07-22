var fs   = require('fs')
  , ee   = require('events').EventEmitter
  , lazy = require('lazy')
  , util = require('util')

  , abbreviations = ['mr', 'mrs', 'dr', 'st', 'rd']

  , abbreviation
  , l = new lazy()

  , corpus = []

module.exports = function (s, name) {
  lazy(s).lines.forEach(function (data) {
    if (typeof data[1] !== 'undefined') {
      var stripped = data.toString().split('\n')[0]
      corpus.push(stripped)
    }
  })

  s.on('end', function () {
    var statements = corpus.join(' ').split('.')

    statements.forEach(function (statement) {
      var abbrTest
      abbreviations.forEach(function (abbr) {
        if (statement.toLowerCase().match(abbr)) {
          abbrTest = true
          return
        }
      })

      if (abbrTest) {
        abbreviation = statement + '.'
        return
      } else if (abbreviation) {
        statement = abbreviation + ' ' + statement
        abbreviation = undefined
      }

      if (statement.match('\\?')) {
        questionArr = statement.split('?')
        l.emit('data', questionArr.shift())
        while (questionArr.length) { l.emit('data', questionArr.shift()) }
        return
      } else if (statement.match('\\!')) {
        exclamationArr = statement.split('!')
        l.emit('data', exclamationArr.shift())
        while (exclamationArr.length) { l.emit('data', exclamationArr.shift()) }
        return
      }
      // console.log(statement)
      l.emit('data', statement)
    })
    l.emit('end')
  })
  return l
}

