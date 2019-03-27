
import ram from './ram'
import rom from './rom'
import mmu from './mmu'
import cpu from './cpu'
import vtm from './vtm'
import io  from './io'

import dbg from './dbg'

const screen = document.getElementById('screen')

rom.load('basic.bin')       // load at 0x8000
rom.load('sys.bin', 0x3f00) // load at 0x8000 + 0x3f00 = 0xbf00
rom.setEP(0x65, 0xa0)       // set basic entry point: low, high

// give the virtual term a screen instance and I/O access
vtm.init(screen, io)

// tick chips
function clock() {

  mmu.adr = cpu.adr
  mmu.logic() // async

  io.adr  = mmu.adr
  rom.adr = mmu.adr
  ram.adr = mmu.adr

  ram.data = cpu.data
  io .data = cpu.data
  ram.we   = cpu.write
  io .we   = cpu.write

  io.logic()
  ram.logic()
  rom.logic()

  // mux
  switch (mmu.sel) {
    case 0:
      cpu.data = rom.data
      break
    case 1:
      cpu.data = ram.data
      break
    case 3:
      cpu.data = io.data
  }

  cpu.logic()
  vtm.clock()
  
  return dbg.checkForBP()
}

// update function - 60 FPS
function update() {

  let i = 89600
  while (i > 0) {
    if (!clock()) break
    i--
  }

  if (dbg.active) {
    dbg.update()
  }
  else {
    vtm.update()
    requestAnimationFrame(update)
  }
}

// reset to get a correct EP
clock() // reset?
clock() // reset0
clock() // reset1
clock() // reset2
dbg.init(screen, rom, ram, cpu, io)
dbg.clock = clock
dbg.process = update
dbg.update()

