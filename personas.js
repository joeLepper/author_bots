var streamer = require('./streamer')
  , markov   = require('./markov')
  , name     = process.argv[2]
  , seed     = process.argv[3]
  , util     = require('util')
  , fs       = require('fs')

var m = markov(2)

if (seed === 'true') {
  var s = fs.createReadStream(__dirname + '/' + name + '.txt')

  m.seed(streamer(s), name, function () {
    console.log('seeding ' + name)
  })
}

process.on('message', function (line) {
  console.log(name)
  m.respond(line.toString(), name, 99, function (response) {
    var message = []

    response.forEach(function (r) {
      message.push(r.split('_').join(' '))
    })
    console.log(message.join(' '))
    process.send({ message: message.join(' ') })
  })
})
