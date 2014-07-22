var fs           = require('fs')
  , Hapi         = require('hapi')
  , bodyParser   = require('body-parser')
  , childProcess = require('child_process')

var server = new Hapi.Server('localhost', 8888)
  , bots   = {}
  , seed   = false

if (process.argv[2] === 'seed') seed = true

var authors = fs.createReadStream(__dirname + '/authors.txt')

authors.setEncoding('utf8')
authors.on('data', function (data) {
  var names = data.split('\n')

  for (var i = 0; i < names.length; i++) {
    var name = names[i]
    createServer(name, seed)
  }
})
server.start()

function createServer (name, seed) {
  bots[name] = childProcess.fork(__dirname + '/personas.js', [name, seed])
  server.route({
    method: 'GET',
    path: '/' + name + '/{message}',
    handler: function (request, reply) {

      var message = request.params.message

      bots[name].on('message', function (data) {
        reply(data)
      })
      bots[name].send(message)
    }
  })
}
