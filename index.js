var hypercore = require('hypercore')
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')
var pump = require('pump')
var ram = require('random-access-idb')('hyperirc')
var html = require('bel')
var dateTime = require('date-time')

var key = window.location.hash.slice(1)

// default to #hypermodules
if (key === '') key = 'f34fd67dac587f49f2e6747e2e1a1dc4633750110390319840bae2ea5d05bdee'

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
  var payload = JSON.parse(msg)
  if (payload.channel) return
  if (!payload.message) {
    var pre = document.createElement('pre')
    pre.innerText = msg
    return $main.appendChild(pre)
  }

  var message = html`
    <div class="message">
      <span class="timestamp">
        <small>${dateTime({ date: new Date(payload.timestamp) })}</small>
      </span>
      <span class="message-container">
        <span class="from">${payload.from}:</span>
        <span class="content">${payload.message}</span>
      </span>
    </div>
  `

  $main.appendChild(message)
}

core.on('ready', function () {
  core.get(0, function (err, channel) {
    if (err) throw err

    var txt

    try {
      txt = JSON.parse(channel.toString()).channel
    } catch (e) {
      txt = channel.toString()
    }

    document.title = document.getElementById('channel').innerText = txt

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

  var sw = swarm(signalhub('hyperirc-' + core.discoveryKey.toString('hex'), [
    'https://signalhub.mafintosh.com',
    'https://signalhub.decent.digital'
  ]))

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
