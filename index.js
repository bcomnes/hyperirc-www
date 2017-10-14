var hypercore = require('hypercore')
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')
var pump = require('pump')
var ram = require('random-access-idb')('hyperirc')

var key = window.location.hash.slice(1)

var all = false
var cnt = 0
var core = hypercore(function (filename) {
  // filename will be one of: data, bitfield, tree, signatures, key, secret_key
  // the data file will contain all your data concattenated.

  // just store all files in ram by returning a random-access-memory instance
  return ram(filename)
}, key, {
  sparse: true
})

var $main = document.getElementById('main')

function log (msg) {
  var pre = document.createElement('pre')
  pre.innerText = msg
  $main.appendChild(pre)
}

core.on('ready', function () {
  core.get(0, function (err, channel) {
    if (err) throw err

    document.title = document.getElementById('channel').innerText = channel.toString()

    var end = core.length
    var stream = tail()

    if (!all) {
      core.get(core.length, function () {
        if (core.length - end > 25) {
          stream.destroy()
          log('(skipping to latest messages)')
          tail()
        }
      })
    }

    function tail () {
      var stream = core.createReadStream({live: true, start: all ? 0 : Math.max(core.blocks - 25, 1)})
      .on('data', function (data) {
        log(data.toString())
      })

      return stream
    }
  })

  var sw = swarm(signalhub('hyperirc-' + core.discoveryKey.toString('hex'), 'https://signalhub.mafintosh.com'))

  console.log('Waiting for peers...')

  sw.on('peer', function (connection) {
    console.log('(webrtc peer joined, %d total', ++cnt)
    document.getElementById('count').innerText = '' + cnt
    var peer = core.replicate()
    pump(peer, connection, peer, function () {
      console.log('(webrtc peer left, %d total', --cnt)
      document.getElementById('count').innerText = '' + cnt
    })
  })
})
