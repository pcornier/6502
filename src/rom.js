
const ROM = {
  // in:
  adr: 0,
  // out:
  data: 0
}

// ROM is mapped to 0x8000-0xffff, see MMU
const memory = new Uint8Array(0x8000)

ROM.logic = function() {
  this.data = memory[this.adr]
}

// load a file in ROM at $offset1 location
// $offset2 is there to load a file that overlaps with RAM/ROM
ROM.load = function(uri, offset1, offset2) {
  offset1 = offset1 | 0
  offset2 = offset2 | 0
  let req = new XMLHttpRequest()
  req.open('GET', uri, false)
  req.overrideMimeType('text\/plain; charset=x-user-defined')
  req.send(null)
  let data = req.responseText.split('').map(c => 0xff & c.charCodeAt(0))
  for (let i = 0; i < data.length; i++) {
    memory[i+offset1] = data[i+offset2]
  }
}

// set entry point... not very conventional
// another way is to hard code the address at CPU:RESET2
// so we can use 0xfffe-0xffff for interrupt vector
ROM.setEP = function(low, high) {
  memory[0x7ffe] = low
  memory[0x7fff] = high
}

// debugger memory access
ROM.inject = function(code) {
  return eval(code)
}

export default ROM