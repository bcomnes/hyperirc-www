var hypercore = require('hypercore')
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')
var pump = require('pump')
var ram = require('random-access-idb')('hyperirc')
var html = require('bel')
var raw = require('bel/raw')
var dateTime = require('date-time')
var linkifyUrls = require('linkify-urls')

// default to #hypermodules
var KEY = 'f34fd67dac587f49f2e6747e2e1a1dc4633750110390319840bae2ea5d05bdee'
var MESSAGE_CAP = 100

var all = false
var peerCount = 0
var msgCount = 0
var core = hypercore(function (filename) {
  // filename will be one of: data, bitfield, tree, signatures, key, secret_key
  // the data file will contain all your data concattenated.

  // just store all files in ram by returning a random-access-memory instance
  return ram(filename)
}, KEY, {
  sparse: true
})

var $main = document.getElementById('main')

function log (msg, idx) {
  msgCount++
  document.getElementById('current-length').innerText = msgCount

  try {
    var payload = JSON.parse(msg)
  } catch (e) {
    return $main.appendChild(html`<div class="message"><pre>${msg}</pre></div>`)
  }

  if (payload.channel) return
  if (!payload.message) {
    var pre = document.createElement('pre')
    pre.innerText = msg
    return $main.appendChild(pre)
  }

  var message = html`
    <div class="message">
      <div class="from">
        <span class="from" style="color: ${stringToColor(payload.from)}">${payload.from}</span>
        <span class="timestamp right">${dateTime({ date: new Date(payload.timestamp) })}</span>
      </div>
      <div class="content">${raw(linkifyUrls(payload.message))}</div>
    </div>
  `

  $main.appendChild(message)
  $main.scrollTop = $main.scrollHeight
}

core.on('ready', function () {
  document.getElementById('total-length').innerText = core.length
  core.get(0, function (err, channel) {
    if (err) throw err

    var txt

    try {
      txt = JSON.parse(channel.toString()).channel
    } catch (e) {
      txt = channel.toString()
    }

    document.title = document.getElementById('channel').innerText = txt

    tail()
  })

  var sw = swarm(signalhub('hyperirc-' + core.discoveryKey.toString('hex'), [
    'https://signalhub.mafintosh.com',
    'https://signalhub.decent.digital'
  ]))

  console.log('Waiting for peers...')

  sw.on('peer', function (connection) {
    console.log('(webrtc peer joined, %d total)', ++peerCount)
    document.getElementById('count').innerText = '' + peerCount
    var peer = core.replicate()
    pump(peer, connection, peer, function () {
      console.log('(webrtc peer left, %d total)', --peerCount)
      document.getElementById('count').innerText = '' + peerCount
    })
  })
})

core.on('append', function () {
  document.getElementById('total-length').innerText = core.length
})

function tail () {
  var index = Math.max(core.length - MESSAGE_CAP, 1)
  var stream = core.createReadStream({
    live: true,
    start: all ? 0 : index
  })
  .on('data', function (data) {
    log(data.toString(), index++)
  })

  return stream
}

// https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript#16348977
function stringToColor (str) {
  var hash = 0
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  var color = '#'
  for (var j = 0; j < 3; j++) {
    var value = (hash >> (j * 8)) & 0xFF
    color += ('00' + value.toString(16)).substr(-2)
  }
  return color
}
