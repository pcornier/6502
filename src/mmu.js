
/*
RAM: 0x0000 - 0x7fff
ROM: 0x8000 - 0xfeff
I/O: 0xff00 - 0xff01
ROM: 0xff02 - 0xffff
*/

const MMU = {
  adr: 0,
  sel: 0, // 0 = rom, 1 = ram, 3 = i/o
}

MMU.logic = function() {
  if (this.adr < 0x8000) {
    this.sel = 1
  }
  else if (this.adr < 0xff00) {
    this.adr = this.adr & 0x7fff
    this.sel = 0
  }
  else if (this.adr < 0xff02) {
    this.adr = this.adr & 1
    this.sel = 3
  }
  else {
    this.adr = this.adr & 0x7fff
    this.sel = 0
  }
}

export default MMU
