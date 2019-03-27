
const RAM = {
  data: 0,
  we: false,
  adr: 0
}

const memory = new Uint8Array(0x8000)

RAM.logic = function() {
  if (this.we) {
    memory[this.adr] = this.data
  }
  this.data = memory[this.adr]
}

// load a file in RAM at $offset location
RAM.load = function(uri, offset) {
  offset = offset | 0
  let req = new XMLHttpRequest()
  req.open('GET', uri, false)
  req.overrideMimeType('text\/plain; charset=x-user-defined')
  req.send(null)
  let data = req.responseText.split('').map(c => 0xff & c.charCodeAt(0))
  for (let i = 0; i < data.length; i++) {
    if (i > memory.length) break
    memory[i+offset] = data[i]
  }
}

// debugger memory access
RAM.inject = function(code) {
  return eval(code)
}

export default RAM
