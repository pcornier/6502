
const IO = {
  adr: 0,
  data: 0,
  we: 0,
  serial_status: 0,
  serial_data: 0
}

IO.logic = function() {
  if (this.we) {
    switch (this.adr) {
      case 0x01:
        this.serial_data = this.data
        this.serial_status = 1
        break
    }
    this.we = 0
  }
  else {
    switch (this.adr) {
      case 0x00:
        this.data = this.serial_status
        break
      case 0x01:
        this.data = this.serial_data
        this.serial_status = 0
        break
    }
  }
}

// debugger memory access
IO.inject = function(code) {
  return eval(code)
}

export default IO
