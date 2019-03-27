
// This debugger is just crap...
// It has been quickly made to help with some CPU errors
//
// Use ESC to turn debugger on/off
// Use F8 to step and F9 to run

const DBG = { 
  active: true,
  bp: []
}

let ctx, ROM, RAM, CPU, IO
const fc = '#867ade'
const bc = '#483aaa'
const ptr = new Image()
ptr.src = './pointer.png'
let cx = 0
let cy = 0
let dump = 0
let prompt = false
let timer = 0
let buffer = ''
let limit = 0
let start = 0
let asm = 0xa065
let pc = 0xa065
let disasm = []
let oldasm
let nextline = 0
let stepping = false
let advance = false

const h8 = function(v) {
  return ('00' + v.toString(16)).substr(-2).toUpperCase()
}

const h16 = function(v) {
  return ('0000' + v.toString(16)).substr(-4).toUpperCase()
}

DBG.checkForBP = function() {
  if (!CPU) return true
  if (DBG.bp.includes(CPU.getPC())) {
    DBG.pause()
    return false
  }
  return true
}

DBG.pause = function() {
  DBG.active = true
  advance = true
} 

DBG.init = function(screen, rom, ram, cpu, io) {
  ROM = rom
  RAM = ram
  CPU = cpu
  IO  = io

  // inject debug functions
  ROM.inject(`
    ROM.dump = function(i) {
      return memory[i]
    }
  `)

  RAM.inject(`
    RAM.dump = function(i) {
      return memory[i]
    }
    
    RAM.wmem = function(i, b) {
      memory[i] = b
    }  
  `)

  CPU.inject(`
    CPU.dump = function() {
      return {
        'a': ra,
        'x': rx,
        'y': ry,
        'pc': pc,
        'ir': ir,
        'im': im,
        'am': am,
        'cycle': cycle,
        'sp': sp,
        'rp': rp,
        'ex': EXECUTE,
        'f1': FETCH1,
        'f2': FETCH2
      }
    }

    CPU.setA = function(b) {
      ra = b
    }
  
    CPU.setX = function(b) {
      rx = b
    }
    
    CPU.setY = function(b) {
      ry = b
    }
    
    CPU.setPC = function(w) {
      pc = w
      this.adr = pc
    }
    
    CPU.getPC = function() {
      return pc
    }
  `)

  IO.inject(`
    IO.dump = function(i) {
      switch (i) {
        case 0x00:
          return this.serial_status
        case 0x01:
          return this.serial_data
      }
      return 0xff
    }
  `)
  
  ctx = screen.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.font = '8px c64'
  pc = CPU.dump().pc
  asm = pc

  window.MP = {}
  window.setMP = function(evt) {
    let rect = screen.getBoundingClientRect()
    let scaleX = screen.width / rect.width
    let scaleY = screen.height / rect.height
    window.MP = {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    }
  }
  window.setMD = function(status) {
    window.MD = status
  }
  window.setKD = function(el, ev) {
    window.KC = ev.keyCode
    window.KD = el.value.slice(-1)
    el.value = ''
    if (window.KC == 123 || window.KC == 27) {
      DBG.active = !DBG.active
      window.KC = false
    }
  }
}

DBG.update = function() {
  if (stepping || advance) {
    let f1 = CPU.dump().f1
    let f2 = CPU.dump().f2
    let ex = CPU.dump().ex
    while(CPU.dump().cycle != ex) DBG.clock()
    while(CPU.dump().cycle != f1 && CPU.dump().cycle != f2) DBG.clock()
    pc = CPU.dump().cycle == f2 ? CPU.dump().pc-1 : CPU.dump().pc
    if (DBG.bp.includes(pc)) stepping = false
    asm = pc
    if (advance) {
      advance = false
      stepping = false
    }
  }

  ctx.fillStyle = bc
  ctx.fillRect(0, 0, 256, 256)
  if (window.KC == 119) { // f8
    advance = true
    window.KC = false
  }
  else if (window.KC == 40) { // down
    asm = nextline
    window.KC = false
  }
  else if (window.KC == 38) { // up
    asm = asm - 1
  }
  else if (window.KC == 120) { // f9
    stepping = !stepping
    window.KC = false
  }
  else if (window.KC == 123) { // esc
    DBG.active = !DBG.active
    window.KC = false
  }

  DBG.mdump(0, 23)
  DBG.asm(0, 1)
  DBG.cpu()
  DBG.breakpoints()
  DBG.cursor()
  DBG.mouse()
  if (DBG.active) {
    requestAnimationFrame(DBG.update)
  }
  else {
    requestAnimationFrame(DBG.process)
  }
}


DBG.cpu = function() {
  let cpu = CPU.dump()
  ctx.fillText('\u250c'+('\u2500'.repeat(9))+'\u2510', 168, 16)
  ctx.fillText(`A:${prompt == 4 ? buffer : h8(cpu.a)}`, 176, 24)
  ctx.fillText(`X:${prompt == 5 ? buffer : h8(cpu.x)}`, 216, 24)
  ctx.fillText('\u2502', 248, 24)
  ctx.fillText(`Y:${prompt == 6 ? buffer : h8(cpu.y)}`, 176, 32)
  ctx.fillText('\u2502', 248, 32)
  ctx.fillText(`PC:\$${prompt == 7 ? buffer : h16(pc)}`, 176, 40)
  ctx.fillText('\u2502', 248, 40)
  ctx.fillText('\u251c'+('\u2500'.repeat(9))+'\u2524', 168, 48)
  ctx.fillText(
    'P' +
    (cpu.rp & 0x80 ? '1' : '-') +
    (cpu.rp & 0x40 ? '1' : '-') +
    (cpu.rp & 0x20 ? '1' : '-') +
    (cpu.rp & 0x10 ? '1' : '-') +
    (cpu.rp & 0x08 ? '1' : '-') +
    (cpu.rp & 0x04 ? '1' : '-') +
    (cpu.rp & 0x02 ? '1' : '-') +
    (cpu.rp & 0x01 ? '1' : '-') + '\u2502',
    176, 56
  )
  ctx.fillText(' nvbbdizc\u2502', 176, 64)
  ctx.fillText('\u251c'+('\u2500'.repeat(9))+'\u2524', 168, 72)
  for (var i = 0; i < 13; i++) {
    let sp = cpu.sp == 0xff - i ? '>' : ' '
    ctx.fillText('\u2502'+ sp + '1' + h8(0xff-i) + ' ' + h8(DBG.mem(0x1ff-i)) + '  \u2502', 168, 80 + i*8)
  }
  ctx.fillText('\u2524', 248, 80+13*8)
  
  let mx = window.MP.x
  let my = window.MP.y
  if (window.MD && my > 16 && my < 24 && mx > 192 && mx < 208) {
    prompt = 4
    start = 24
    limit = 2
    cx = 24
    cy = 2
    window.MD = false
  }
  else if (window.MD && my > 16 && my < 24 && mx > 232 && mx < 248) {
    prompt = 5
    start = 29
    limit = 2
    cx = 29
    cy = 2
    window.MD = false
  }
  else if (window.MD && my > 24 && my < 32 && mx > 192 && mx < 208) {
    prompt = 6
    start = 24
    limit = 2
    cx = 24
    cy = 3
    window.MD = false
  }
  else if (window.MD && my > 32 && my < 40 && mx > 208 && mx < 232) {
    prompt = 7
    start = 26
    limit = 4
    cx = 26
    cy = 4
    window.MD = false
  }
}

DBG.breakpoints = function() {
  let mx = window.MP.x
  let my = window.MP.y
  if (window.MD && my > 2 && mx > 40 && my < 176 && mx < 48) {
    let row = ((window.MP.y - 16) / 8) | 0
    let pos = false
    for (var i in DBG.bp)
      if (DBG.bp[i] == disasm[row].adr) pos = i
    if (pos) {
      DBG.bp.splice(pos, 1)
    }
    else {
      DBG.bp.push(disasm[row].adr)
    }
    window.MD = false
  }
}

DBG.mouse = function() {
  let mp = window.MP
  ctx.drawImage(ptr, mp.x, mp.y)
}

DBG.cursor = function() {
  if (!prompt) return
  if (window.KC && buffer.length < limit) {
    if ((/[0-9a-f]/i).test(window.KD)) {
      buffer += window.KD
      ctx.fillStyle = fc
      ctx.fillText(window.KD, cx * 8, cy * 8 + 8)
      window.KC = false
      if (buffer.length < limit) cx += 1
    }
  }
  else if (window.KC && (/[0-9a-f]/i).test(window.KD)) {
    let ba = [...buffer]
    ba[cx-start] = window.KD
    buffer = ba.join('')
    window.KC = false
    if (cx < start+limit-1) cx += 1
  }
  else if (window.KC == 37 && cx > start) {
    cx -= 1
    window.KC = false
  }
  else if (window.KC == 39 && cx < start+limit-1) {
    cx += 1
    window.KC = false
  }
  if (window.KC == 13) {
    switch(prompt) {
      case 1:
        dump = parseInt(buffer, 16)
        dump = Math.max(0, Math.min(dump, 0xffff-0x60))
        buffer = ''
        break
      case 2:
        asm = parseInt(buffer, 16)
        asm = Math.max(0, Math.min(asm, 0xffff-19))
        buffer = ''
        break
      case 3:
        var b = parseInt(buffer, 16)
        b = Math.max(0, Math.min(b, 0xff))
        let adr = dump + (cy - 23) * 12 + (start - 6) / 2
        DBG.wmem(adr, b)
        buffer = ''
        break
      case 4:
        var b = parseInt(buffer, 16)
        b = Math.max(0, Math.min(b, 0xff))
        CPU.setA(b)
        buffer = ''
        break
      case 5:
        var b = parseInt(buffer, 16)
        b = Math.max(0, Math.min(b, 0xff))
        CPU.setX(b)
        buffer = ''
        break
      case 6:
        var b = parseInt(buffer, 16)
        b = Math.max(0, Math.min(b, 0xff))
        CPU.setY(b)
        buffer = ''
        break
      case 7:
        var w = parseInt(buffer, 16)
        w = Math.max(0, Math.min(w, 0xffff))
        console.log(w)
        CPU.setPC(w)
        buffer = ''
        break
        
    }
    prompt = false
  }
  if (timer > 5) {
    ctx.fillText('\u2584', cx * 8, cy * 8 + 8)
  }
  else {
    ctx.fillText(' ', cx * 8, cy * 8 + 8)
  }
  timer = (timer + 1) % 10
}

DBG.asm = function(c, r) {
  r = r * 8 + 8
  c = c * 8
  ctx.fillText('\u250c' + ('\u2500'.repeat(19)) + '\u252c\u2510', c, r)
  let cpu = CPU.dump()
  let opc = {
    'lda': { 0xAD: 'a', 0xBD: 'a,x', 0xB9: 'a,y', 0xA9: '#', 0xA5: 'zp', 0xA1: '(zp,x)', 0xB5: 'zp,x', 0xB1: '(zp),y' },
    'ldx': { 0xAE: 'a', 0xBE: 'a,y', 0xA2: '#', 0xA6: 'zp', 0xB6: 'zp,y' },
    'ldy': { 0xAC: 'a', 0xBC: 'a,x', 0xA0: '#', 0xA4: 'zp', 0xB4: 'zp,x' },
    'sta': { 0x8D: 'a', 0x9D: 'a,x', 0x99: 'a,y', 0x85: 'zp', 0x81: '(zp,x)', 0x95: 'zp,x', 0x91: '(zp),y' },
    'stx': { 0x8E: 'a', 0x86: 'zp', 0x96: 'zp,y' },
    'sty': { 0x8C: 'a', 0x84: 'zp', 0x94: 'zp,x' },
    'adc': { 0x6D: 'a', 0x7D: 'a,x', 0x79: 'a,y', 0x69: '#', 0x65: 'zp', 0x61: '(zp,x)', 0x75: 'zp,x', 0x71: '(zp),y' },
    'sbc': { 0xED: 'a', 0xFD: 'a,x', 0xF9: 'a,y', 0xE9: '#', 0xE5: 'zp', 0xE1: '(zp,x)', 0xF5: 'zp,x', 0xF1: '(zp),y' },
    'inc': { 0xEE: 'a', 0xFE: 'a,x', 0xE6: 'zp', 0xF6: 'zp,x' },
    'inx': { 0xE8: 'i' },
    'iny': { 0xC8: 'i' },
    'dec': { 0xCE: 'a', 0xDE: 'a,x', 0xC6: 'zp', 0xD6: 'zp,x' },
    'dex': { 0xCA: 'i' },
    'dey': { 0x88: 'i' },
    'asl': { 0x0E: 'a', 0x1E: 'a,x', 0x0A: 'A', 0x06: 'zp', 0x16: 'zp,x' },
    'lsr': { 0x4E: 'a', 0x5E: 'a,x', 0x4A: 'A', 0x46: 'zp', 0x56: 'zp,x' },
    'rol': { 0x2E: 'a', 0x3E: 'a,x', 0x2A: 'A', 0x26: 'zp', 0x36: 'zp,x' },
    'ror': { 0x6E: 'a', 0x7E: 'a,x', 0x6A: 'A', 0x66: 'zp', 0x76: 'zp,x' },
    'and': { 0x2D: 'a', 0x3D: 'a,x', 0x39: 'a,y', 0x29: '#', 0x25: 'zp', 0x21: '(zp,x)', 0x35: 'zp,x', 0x31: '(zp),y' },
    'ora': { 0x0D: 'a', 0x1D: 'a,x', 0x19: 'a,y', 0x09: '#', 0x05: 'zp', 0x01: '(zp,x)', 0x15: 'zp,x', 0x11: '(zp),y' },
    'eor': { 0x4D: 'a', 0x5D: 'a,x', 0x59: 'a,y', 0x49: '#', 0x45: 'zp', 0x41: '(zp,x)', 0x55: 'zp,x', 0x51: '(zp),y' },
    'cmp': { 0xCD: 'a', 0xDD: 'a,x', 0xD9: 'a,y', 0xC9: '#', 0xC5: 'zp', 0xC1: '(zp,x)', 0xD5: 'zp,x', 0xD1: '(zp),y' },
    'cpx': { 0xEC: 'a', 0xE0: '#', 0xE4: 'zp' },
    'cpy': { 0xCC: 'a', 0xC0: '#', 0xC4: 'zp' },
    'bit': { 0x2C: 'a', 0x89: '#', 0x24: 'zp' },
    'bcc': { 0x90: 'r' },	'bcs': { 0xB0: 'r' },
    'beq': { 0xF0: 'r' }, 'bmi': { 0x30: 'r' },
    'bne': { 0xD0: 'r' },	'bpl': { 0x10: 'r' },
    'bvc': { 0x50: 'r' },	'bvs': { 0x70: 'r' },
    'tax': { 0xAA: 'i' }, 'txa': { 0x8A: 'i' },
    'tay': { 0xA8: 'i' }, 'tya': { 0x98: 'i' },
    'tsx': { 0xBA: 'i' }, 'txs': { 0x9A: 'i' },
    'pha': { 0x48: 'i' }, 'pla': { 0x68: 'i' },
    'php': { 0x08: 'i' }, 'plp': { 0x28: 'i' },
    'jmp': { 0x4C: 'a', 0x6C: '(a)' },
    'jsr': { 0x20: 'a' }, 'rts': { 0x60: 'i' }, 'rti': { 0x40: 'i' },
    'sec': { 0x38: 'i' }, 'sed': { 0xF8: 'i' }, 'sei': { 0x78: 'i' },
    'clc': { 0x18: 'i' }, 'cld': { 0xD8: 'i' }, 'cli': { 0x58: 'i' }, 'clv': { 0xB8: 'i' },
    'nop': { 0xEA: 'i' }, 'brk': { 0x00: 'i' }, 'err': {}
  }
  if (oldasm != asm) {
    oldasm = asm
    let i = 0
    disasm = []
    for(var l = 0; l < 20; l++) {
      if (l == 1) nextline = asm+i
      let b = DBG.mem(asm+i).toString()
      let op
      let prm = ''
      for(op of Object.keys(opc)) {
        if (Object.keys(opc[op]).includes(b)) break
      }
    
      let y = r + (l+1) * 8
      let onpc = pc == asm+i
      let cde = { adr: asm+i }
    
      switch (opc[op][b]) {
        case '#':
          prm = ' #$' + h8(DBG.mem(asm+i+1))
          i += 2
          break
        case 'a':
          var adr = (DBG.mem(asm+i+2) << 8) | DBG.mem(asm+i+1)
          prm = ' $' + h16(adr)
          i += 3
          break
        case 'a,x':
          var adr = (DBG.mem(asm+i+2) << 8) | DBG.mem(asm+i+1)
          prm = ' $' + h16(adr) + ',x'
          i += 3
          break
        case 'a,y':
          var adr = (DBG.mem(asm+i+2) << 8) | DBG.mem(asm+i+1)
          prm = ' $' + h16(adr) + ',y'
          i += 3
          break
        case '(zp),y':
          var adr = DBG.mem(asm+i+1)
          prm = ' $(' + h8(adr) + '),y'
          i += 2
          break
        case '(zp,x)':
          var adr = DBG.mem(asm+i+1)
          prm = ' $(' + h8(adr) + ',x)'
          i += 2
          break
        case 'zp':
          var adr = DBG.mem(asm+i+1)
          prm = ' $' + h8(adr)
          i += 2
          break
        case 'zp,x':
          prm = ' $' + h8(DBG.mem(asm+i+1)) + ',x'
          i += 2
          break
        case 'zp,y':
          prm = ' $' + h8(DBG.mem(asm+i+1)) + ',y'
          i += 2
          break
        case 'A':
        case 'i':
          i += 1
          break
        case 'r':
          var adr = DBG.mem(asm+i+1)
          var ofs = adr >= 0x80 ? adr - 0x100 : adr
          prm = ` \$${h16(asm+i+ofs)}(${ofs})`
          i += 2
          break
        case '(a)':
          var adr = (DBG.mem(asm+i+2) << 8) | DBG.mem(asm+i+1)
          prm = ' ($' + h16(adr) + ')'
          i += 2
          break
        default: // error
          prm = '!'
          i += 1
          break
      }
      
      cde.op = op
      cde.prm = prm
      cde.onpc = onpc
      disasm.push(cde)
    }
  }
  
  for(var l = 0; l < 20; l++) {
    let y = r + (l+1) * 8
    ctx.fillText('\u2502', c, y)
    if (disasm[l].onpc) {
      ctx.fillStyle = '#0088FF'
      ctx.fillRect(8, l*8+16, 152, 8)
    }
    ctx.fillStyle = disasm[l].onpc ? bc : fc
    ctx.fillText(prompt == 2 && l == 0 ? buffer : h16(disasm[l].adr), c + 8, y) 
    ctx.fillText(disasm[l].op + disasm[l].prm, c + 48, y)
    if (DBG.bp.includes(disasm[l].adr)) {
      ctx.fillStyle = '#FF7777'
      ctx.fillText('\u2022', c + 40, y)
    }
    ctx.fillStyle = fc
    ctx.fillText('\u2502\u2502', c + 160, y)
  }

  ctx.fillText('\u2534\u2534', c + 160, r + (l+1) * 8)

  let mx = window.MP.x
  let my = window.MP.y
  let sy = 0xffff / 168
  if (window.MD && my > 8 && mx > 160 && my < 176 && mx < 168) {
    let mv = window.MP.y - 8
    asm = Math.max(0, Math.min((mv*sy)|0, 0xffff))
  }
  else if (window.MD && my > 16 && mx > 8 && my < 24 && mx < 40) {
    prompt = 2
    start = 1
    limit = 4
    cx = 1
    cy = 2
    window.MD = false
  }
  else if (window.MD || window.KC == 27) {
    prompt = false
    buffer = ''
    window.KC = false
  }
  
  let y = asm / sy
  ctx.fillRect(166, y, 4, 8)
  
}

DBG.mem = function(i) {
  if (i < 0x8000) {
    return RAM.dump(i)
  }
  else if (i < 0xff00) {
    i = i & 0x7fff
    return ROM.dump(i)
  }
  else if (i < 0xff02) {
    i = i & 1
    return IO.dump(i)
  }
  else {
    i = i & 0x7fff
    return ROM.dump(i)
  } 
}

DBG.wmem = function(i, b) {
  if (i < 0x8000) {
    return RAM.wmem(i, b)
  }
  else if (i == 0xff00) {
    return IO.wmem(0xff00, b)
  }
  else if (i == 0xff01) {
    return IO.wmem(0xff01, b)
  }
}


DBG.mdump = function(c, r) {
  r = r * 8 + 8
  c = c * 8
  let cols = 8
  let rows = 8
  let len = cols * rows

  ctx.fillStyle = fc
  ctx.fillText('\u251c'+('\u2500'.repeat(29))+'\u252c\u2510', c, r-8)
  for (var row = 0; row < rows; row++) {
    let y = r + row * 8
    if (row == 0 && prompt == 1) {
      ctx.fillText(`\u2502${buffer}`, c, y)
    }
    else {
      ctx.fillText(`\u2502${h16(dump+row*cols)}`, c, y)
    }
    ctx.fillText(':', c + 40, y)
    
    for (var col = 0; col < cols; col++) {
      let i = row * 8 + col + dump
      let x = c + col * 16 + 48
      if (prompt == 3 && (cy+1)*8 == y && start*8 == x) {
        ctx.fillText(buffer, x, y)
      }
      else {
        ctx.fillText(h8(DBG.mem(i)), x, y)
      }
    }
    
    for (var col = 0; col < cols; col++) {
      let i = row * 8 + col + dump
      let x = c + 176 + col * 8
      ctx.fillText(String.fromCharCode(DBG.mem(i)), x, y)
    }
    
    ctx.fillText('\u2502\u2502', c + 240, y)
  }
  ctx.fillText('\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2518', 0, r + rows * 8)
  
  let mx = window.MP.x
  let my = window.MP.y
  let sy = 0xffff / (rows * 8)
  let x = c + 246
  if (window.MD && my > r && mx > x) {
    let mv = (window.MP.y - r)
    dump = Math.max(0, Math.min((mv*sy)|0, 0xffff-len))
  }
  
  if (window.MD && my > r-8 && my < r && mx > 8 && mx < 40) {
    prompt = 1
    start = 1
    limit = 4
    cx = 1
    cy = 23
    window.MD = false
  }
  else if (window.MD && my > r-8 && mx > 48 && mx < 176) {
    prompt = 3
    start = (mx>>4)<<1
    limit = 2
    cx = start
    cy = (my / 8) | 0
    window.MD = false
  }
  else if (window.MD || window.KC == 27) {
    prompt = false
    buffer = ''
    window.KC = false
  }
  
  let y = r - 8 + dump / sy
  ctx.fillRect(x, y, 4, 8)
}

export default DBG