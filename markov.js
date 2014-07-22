var EventEmitter = require('events').EventEmitter
  , deck         = require('deck')
  , Lazy         = require('lazy')
  , Hash         = require('hashish')
  , cql          = require('node-cassandra-cql')


  , logLevel = 'warn'
  , self = {}
  , processingCount = 0
  , savedCount = 0
  , client = new cql.Client({ hosts : 'localhost:9160'
                            , keyspace : 'authors'
                            , staleTime : 100
                            })
  , connected
  , order
  , sentenceQueue = []
  , queries = []


module.exports = function (_order) {

  order = _order

  client.connect(function (err) {
    if (err) console.error(err)
    else {
      console.log('connected')
      setInterval(processQueries, 20)
    }
  })

  client.on('log', function(level, message) {
    if(level === logLevel) console.log('log event: %s -- %j', level, message)
  })

  if (!order) order = 2

  self.seed = function (seed, name, cb) {
    seed.on('data', function (data) {
      insertSentence(data, name)
    })
    seed.on('end', function () { if (cb) cb(null) })
  };

  self.search = function (text, author, cb) {
    var words = text.split(/\s+/);

    // find a starting point...
    var start
      , groups = {}

    for (var i = 0; i < words.length; i += order) {
      var word = clean(words.slice(i, i + order).join(' '))
        , query = 'SELECT * FROM authors WHERE author = ? AND words = ?'
        , params = [author, text]

      client.execute(query, params, function (err, data) {
        if (err) return console.error(err)
        cb(deck.pick(data.rows))
      })
    }
  };

  self.pick = function (author, cb) {
    var query = 'SELECT * FROM authors WHERE author = ?'
      , param = [author]
      , num

    client.execute(query, param, function (err, data) {
      if (err) return console.error(err)
      cb(deck.pick(data.rows))
    })
  };

  self.next = function (cur, author, cb) {
    get('next', cur, author, cb)
  };

  self.prev = function (cur, author, cb) {
    get('prev', cur, author, cb)
  };

  self.forward = function (cur, author, limit, cb) {
    var res = [];
    recurseForward(cur, author, limit, res, cb)
  };

  self.backward = function (cur, author, limit, cb) {
    var res = [];
    recurseBackward(cur, author, limit, res, cb)
  };

  self.fill = function (cur, author, limit, cb) {
    var res = [cur.words]
      , complete = false

    if (!res[0]) return cb([])
    if (limit && res.length >= limit) return cb(res)

    self.forward(cur.words, author, limit, function (_res) {
      _res.forEach(function (r) { res.push(r) })
      if (complete) return cb(res)
      complete = true
    })

    self.backward(cur.words, author, limit, function (_res) {
      _res.forEach(function (r) { res.unshift(r) })
      if (complete) return cb(res)
      complete = true
    })
  };

  self.respond = function (text, author, limit, cb) {
    console.log(author)
    self.search(text, author, function (words) {
      if (!words) {
        self.pick(author, function (words) {
          self.fill(words, author, limit, cb)
        })
      }
      else self.fill(words, author, limit, cb)
    })
  };

  return self;
};

/* ----------------------------------------------------------------------- *
 *
 *                             PRIVATE
 *
 * ----------------------------------------------------------------------- */


function clean (s) {
  return s
  .toLowerCase()
  .replace(/[^a-z\d]+/g, '_')
  .replace(/^_/, '')
  .replace(/_$/, '')
  ;
}

function resHandler (err, data) {
  if (err) {
    console.error('// ==================== \nExecutionError: ' + err + '\n// ====')
    return
  }
  else console.log('// =================== \nSUCCESSFUL BATCH\n// ====')
}

function insertSentence (data, name) {

  var text  = data
    , words = text.split(/\s+/)
    , links = []

  for (var i = 0; i < words.length; i += order) {
    var link = words.slice(i, i + order).join(' ')
    links.push(link)
  }
  if (!links.length) {
    return
  }

  for (var j = 1; j < links.length; j++) {
    countProcessing()
    var word = clean(links[j-1])
      , next = clean(links[j])

    if (j > 1 && j === links.length - 1) {
      var prev = clean(links[j-2])
      queries.push({ query  : 'INSERT INTO authors (author, words, next, prev, uuid) VALUES (?, ?, ?, ?, now() )'
                      , params : [name, word, next, prev]
                      })
    }
    else if (j === links.length - 1) {
      queries.push({ query  : 'INSERT INTO authors (author, words, prev, uuid) VALUES ( ?, ?, ?, now() )'
                      , params : [name, word, prev]
                      })
    }
    else {
      queries.push({ query  : 'INSERT INTO authors (author, words, next, uuid) VALUES ( ?, ?, ?, now() )'
                      , params : [name, word, next]
                      })
    }
  }
}

function processQueries () {
  if (!queries.length) return
  var q = queries.pop()

  client.execute(q.query, q.params, function (err, data) {
    if (err) console.error(err)
    else countSaved()
  })
}

function countProcessing () {
  processingCount++
}

function countSaved () {
  savedCount++
  if (processingCount === savedCount) console.log('finished')
}

function get (direction, cur, author, cb) {
  var query = 'SELECT * FROM authors WHERE author = ? AND words = ?'
    , params = [author, cur]

  client.execute(query, params, function (err, data) {
    if (err) return console.error(err)
    else if (!data.rows.length) return cb(undefined)
    var row = deck.pick(data.rows)
      , word = row[direction]

    cb(word)
  })
}

function recurseForward (cur, author, limit, res, cb) {
  self.next(cur, author, function (next) {
    if (!next || res.length > limit) return cb(res)
    res.push(next)
    recurseForward(next, author, limit, res, cb)
  })
}

function recurseBackward (cur, author, limit, res, cb) {
  self.prev(cur, author, function (prev) {
    if (!prev || res.length > limit) return cb(res)
    res.unshift(prev)
    recurseForward(prev, author, limit, res, cb)
  })
}

