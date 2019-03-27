
// 6502. Only official opcodes but it passes the set of 
// functional tests from Klauss Dormann: https://github.com/Klaus2m5/6502_65C02_functional_tests
// There's no interrupt mechanism except for BRK

const CPU = {
  reset: true,
  adr  : 0,
  nmi  : 0,
  data : 0,
  write: 0,
  read : 0
}

let ra    = 0       // Accumulator
let rx    = 0       // X register
let ry    = 0       // Y register
let pc    = 0       // PC
let ir    = 0       // internal instruction register
let im    = 0       // internal register for immediate value
let am    = 0       // Addressing mode register
let cycle = 0       // current CPU state
let sp    = 0xff    // stack pointer
let rp    = 1 << 5  // P register (status register)

// states
const RESET0  = Symbol('RESET0'  )
const RESET1  = Symbol('RESET1'  )
const RESET2  = Symbol('RESET2'  )
const FETCH1  = Symbol('FETCH1'  )
const FETCH2  = Symbol('FETCH2'  )
const DECODE  = Symbol('DECODE'  )
const IND0    = Symbol('IND0'    )
const IND1    = Symbol('IND1'    )
const ZPIY0   = Symbol('ZPIY0'   )
const ZPIY1   = Symbol('ZPIY1'   )
const IMREAD  = Symbol('IMREAD'  )
const EXECUTE = Symbol('EXECUTE' )
const PULLA   = Symbol('PULLA'   )
const PULLP   = Symbol('PULLP'   )
const JSR0    = Symbol('JSR0'    )
const JSR1    = Symbol('JSR1'    )
const RTS0    = Symbol('RTS0'    )
const RTS1    = Symbol('RTS1'    )
const MEMOP   = Symbol('MEMOP'   )
const BRK0    = Symbol('BRK0'    )
const BRK1    = Symbol('BRK1'    )
const BRK2    = Symbol('BRK2'    )
const BRK3    = Symbol('BRK3'    )
const BRK4    = Symbol('BRK4'    )
const RTI0    = Symbol('RTI0'    )
const RTI1    = Symbol('RTI1'    )
const RTI2    = Symbol('RTI2'    )

const SN = 1 << 7
const SV = 1 << 6
const SB = 1 << 5 // always 1
const SS = 1 << 4 // stack source flag
const SD = 1 << 3
const SI = 1 << 2
const SZ = 1 << 1
const SC = 1 << 0


CPU.logic = function() {

  switch (cycle) {

    case RESET0:
      this.adr = 0xfffe
      this.write = 0
      cycle = RESET1
      break
      
    case RESET1:
      im = this.data
      this.adr = 0xffff
      cycle = RESET2
      break
      
    case RESET2:
      pc = (this.data << 8) | im
      this.adr = pc
      cycle = FETCH1
      break

    case FETCH1:
      pc = pc + 1
      ir = this.data
      this.write = 0
      this.adr = pc
      this.read = 1
      cycle = FETCH2
      break

    case FETCH2:
      pc = pc + 1
      im = this.data
      this.adr = pc
      this.read = 1
      cycle = DECODE
      break

    case DECODE:
      
      // decode addressing mode
      am = ((ir & 0xf) << 4) | ((ir >> 4) & 1)

      switch (am) {

        // i r # a
        case 0x00: case 0x01: case 0x90: case 0xa1:
        case 0x80: case 0x81: case 0xa0:
          if (ir == 0x20) { // jsr a
            im = (this.data << 8) | im
          }
          cycle = EXECUTE
          break

        // (zp, x)
        case 0x10:
          this.adr =  (im + rx) & 0xff
          cycle = IND0
          break

        // (zp), y
        case 0x11:
          this.adr = im
          cycle = ZPIY0
          break

        // #
        case 0x20:
          cycle = EXECUTE
          break

        // zp
        case 0x40:
        case 0x50:
        case 0x60:
          this.adr = im
          cycle = IMREAD
          break

        // zp,x
        case 0x41:
        case 0x51:
        case 0x61:
          this.adr = (im + rx) & 0xff
          if (ir == 0x96) this.adr = (im + ry) & 0xff
          else if (ir == 0xb6) this.adr = (im + ry) & 0xff
          else this.adr = (im + rx) & 0xff
          cycle = IMREAD
          break

        // a,y
        case 0x91:
          im = (this.data << 8) | im
          im = im + ry
          this.adr = im
          pc = pc + 1
          cycle = IMREAD
          break

        // a (a)
        case 0xc0:
        case 0xd0:
        case 0xe0:
          this.adr = (this.data << 8) | im
          pc = pc + 1
          cycle = ir == 0x6c ? IND0 : IMREAD
          break

        // a,x a,y
        case 0xc1:
        case 0xd1:
        case 0xe1:
          im = ((this.data << 8) | im) + (ir == 0xbe ? ry : rx)
          this.adr = im
          pc = pc + 1
          cycle = IMREAD
          break
      }
      break

    case ZPIY0:
      this.adr = this.adr + 1
      im = this.data
      cycle = ZPIY1
      break
      
    case ZPIY1:
      this.adr = ((this.data << 8) | im) + ry
      cycle = IMREAD
      break

    case IND0:
      this.adr = this.adr + 1
      im = this.data
      cycle = IND1
      break

    case IND1:
      this.adr = (this.data << 8) | im
      cycle = IMREAD
      break

    case IMREAD:
      im = this.data
      this.read = 0
      cycle = EXECUTE
      break

    case EXECUTE:

      switch (ir) {

        // LDA
        case 0xAD: case 0xBD: case 0xB9: case 0xA9:
        case 0xA5: case 0xA1: case 0xB5: case 0xB1:
          ra = im
          this.adr = pc
          rp = ra == 0 ? rp |= SZ : rp &= ~SZ
          rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
          cycle = FETCH1
          break

        // LDX
        case 0xAE: case 0xBE: case 0xA2: case 0xA6: case 0xB6:
          rx = im
          this.adr = pc
          rp = rx == 0 ? rp |= SZ : rp &= ~SZ
          rp = rx >= 0x80 ? rp |= SN : rp &= ~SN
          cycle = FETCH1
          break

        // LDY
        case 0xAC: case 0xBC: case 0xA0: case 0xA4: case 0xB4:
          ry = im
          this.adr = pc
          rp = ry == 0 ? rp |= SZ : rp &= ~SZ
          rp = ry >= 0x80 ? rp |= SN : rp &= ~SN
          cycle = FETCH1
          break

        // STA
        case 0x8D: case 0x9D: case 0x99: case 0x85:
        case 0x81: case 0x95: case 0x91:
          this.data = ra
          this.write = 1
          cycle = MEMOP
          break

        // STX
        case 0x8E: case 0x86: case 0x96:
          this.data = rx
          this.write = 1
          cycle = MEMOP
          break

        // STY
        case 0x8C: case 0x84: case 0x94:
          this.data = ry
          this.write = 1
          cycle = MEMOP
          break

        // ADC
        case 0x6D: case 0x7D: case 0x79: case 0x69:
        case 0x65: case 0x61: case 0x75: case 0x71:
          var t
          var c = rp & SC > 0 ? 1 : 0
          if ((rp & SD) > 0) {
            t = (ra & 0xf) + (im & 0xf) + c
            if (t > 9) t = t + 6
            t = t + (ra & 0xf0) + (im & 0xf0)
            if ((t & 0x1f0) > 0x90) t = t + 0x60
          }
          else {
            t = ra + im + c
          }
          rp = t > 0xff ? rp |= SC : rp &= ~SC
          t = t & 0xff
          rp = !((ra ^ im) & 0x80)!=0 && ((ra ^ t) & 0x80)!=0 ? rp |= SV : rp &= ~SV
          rp = t == 0 ? rp |= SZ : rp &= ~SZ
          rp = t >= 0x80 ? rp |= SN : rp &= ~SN
          ra = t
          this.adr = pc
          cycle = FETCH1
          break

        // SBC
        case 0xED: case 0xFD: case 0xF9: case 0xE9:
        case 0xE5: case 0xE1: case 0xF5: case 0xF1:
          var t
          var c = rp & SC > 0 ? 1 : 0
          if ((rp & SD) > 0) {
            t = (ra & 0xf) - (im & 0xf) - (1-c)
            if ((t & 0x10) != 0) {
              t = ((t-6) & 0xf) | ((ra & 0xf0) - (im & 0xf0) - 0x10)
            } else {
              t = (t & 0xf) | ((ra & 0xf0) - (im & 0xf0))
            }
            if ((t & 0x100) != 0) t = t - 0x60
            rp = t < 0x100 ? rp |= SC : rp &= ~SC
          }
          else {
            t = ra - im - (1-c)
          }
          rp = t < 0 ? rp &= ~SC : rp |= SC
          t = t & 0xff
          rp = ((ra ^ im) & 0x80) != 0 && ((ra ^ t) & 0x80) != 0 ? rp |= SV : rp &= ~SV
          rp = t == 0 ? rp |= SZ : rp &= ~SZ
          rp = t >= 0x80 ? rp |= SN : rp &= ~SN
          ra = t
          this.adr = pc
          cycle = FETCH1
          break
        
        // INC
        case 0xEE: case 0xFE: case 0xE6: case 0xF6:
          this.data = (im + 1) & 0xff
          this.write = 1
          rp = this.data == 0 ? rp |= SZ : rp &= ~SZ
          rp = this.data >= 0x80 ? rp |= SN : rp &= ~SN
          cycle = MEMOP
          break

        // INX
        case 0xE8:
          rx = (rx + 1) & 0xff
          rp = rx == 0 ? rp |= SZ : rp &= ~SZ
          rp = rx >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // INY
        case 0xC8:
          ry = (ry + 1) & 0xff
          rp = ry == 0 ? rp |= SZ : rp &= ~SZ
          rp = ry >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // DEC
        case 0xCE: case 0xDE: case 0xC6: case 0xD6:
          this.data = (im - 1) & 0xff
          this.write = 1
          rp = this.data == 0 ? rp |= SZ : rp &= ~SZ
          rp = this.data >= 0x80 ? rp |= SN : rp &= ~SN
          cycle = MEMOP
          break

        // DEX
        case 0xCA:
          rx = (rx - 1) & 0xff
          rp = rx == 0 ? rp |= SZ : rp &= ~SZ
          rp = rx >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // DEY
        case 0x88: 
          ry = (ry - 1) & 0xff
          rp = ry == 0 ? rp |= SZ : rp &= ~SZ
          rp = ry >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break
        
        // ASL
        case 0xE: case 0x1E: case 0x06: case 0x16: 
          var a = (im << 1) & 0xff
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (im & 0x80) != 0 ? rp |= SC : rp &= ~SC
          this.data = a
          this.write = 1
          cycle = MEMOP
          break
        
        // ASL A
        case 0x0A:
          var a = (ra << 1) & 0xff
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (ra & 0x80) > 0 ? rp |= SC : rp &= ~SC
          ra = a
          ir = im
          cycle = FETCH2
          break

        // LSR
        case 0x4E: case 0x5E: case 0x46: case 0x56:
          var c = (rp & SC) != 0 ? 1 : 0
          var a = (im >> 1) & 0xff
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (im & 1) != 0 ? rp |= SC : rp &= ~SC
          this.data = a
          this.write = 1
          cycle = MEMOP
          break

        // LSR A
        case 0x4A:
          var a = (ra >> 1) & 0xff
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (ra & 1) > 0 ? rp |= SC : rp &= ~SC
          ra = a
          ir = im
          cycle = FETCH2
          break

        // ROL
        case 0x2E: case 0x3E: case 0x26: case 0x36:
          var c = (rp & SC) != 0 ? 1 : 0
          var a = ((im << 1) & 0xff) | c
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (im & 0x80) > 0 ? rp |= SC : rp &= ~SC
          this.data = a
          this.write = 1
          cycle = MEMOP
          break

        // ROL A
        case 0x2A:
          var c = (rp & SC) != 0 ? 1 : 0
          var a = ((ra << 1) & 0xff) | c
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (ra & 0x80) > 0 ? rp |= SC : rp &= ~SC
          ra = a
          ir = im
          cycle = FETCH2
          break

        // ROR
        case 0x6E: case 0x7E: case 0x66: case 0x76:
          var c = (rp & SC) != 0 ? 1 : 0
          var a = ((im >> 1) & 0xff) | (c << 7)
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (im & 1) > 0 ? rp |= SC : rp &= ~SC
          this.data = a
          this.write = 1
          cycle = MEMOP
          break

        // ROR A
        case 0x6A:
          var c = (rp & SC) != 0 ? 1 : 0
          var a = ((ra >> 1) & 0xff) | (c << 7)
          rp = a == 0 ? rp |= SZ : rp &= ~SZ
          rp = a >= 0x80 ? rp |= SN : rp &= ~SN
          rp = (ra & 1) != 0 ? rp |= SC : rp &= ~SC
          ra = a
          ir = im
          cycle = FETCH2
          break

        // AND
        case 0x2D: case 0x3D: case 0x39: case 0x29:
        case 0x25: case 0x21: case 0x35: case 0x31:
          ra = ra & im
          rp = ra == 0 ? rp |= SZ : rp &= ~SZ
          rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
          this.adr = pc
          cycle = FETCH1
          break

        // ORA
        case 0x0D: case 0x1D: case 0x19: case 0x09:
        case 0x05: case 0x01: case 0x15: case 0x11:
          ra = ra | im
          rp = ra == 0 ? rp |= SZ : rp &= ~SZ
          rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
          this.adr = pc
          cycle = FETCH1
          break

        // EOR
        case 0x4D: case 0x5D: case 0x59: case 0x49:
        case 0x45: case 0x41: case 0x55: case 0x51:
          ra = ra ^ im
          rp = ra == 0 ? rp |= SZ : rp &= ~SZ
          rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
          this.adr = pc
          cycle = FETCH1
          break

        // CMP
        case 0xCD: case 0xDD: case 0xD9: case 0xC9:
        case 0xC5: case 0xC1: case 0xD5: case 0xD1:
          var d = (ra - im) & 0xff
          rp = d == 0 ? rp |= SZ : rp &= ~SZ
          rp = d >= 0x80 ? rp |= SN : rp &= ~SN
          rp = ra >= im ? rp |= SC : rp &= ~SC
          this.adr = pc
          cycle = FETCH1
          break

        // CPX
        case 0xEC: case 0xE0: case 0xE4:
          var d = (rx - im) & 0xff
          rp = d == 0 ? rp |= SZ : rp &= ~SZ
          rp = d >= 0x80 ? rp |= SN : rp &= ~SN
          rp = rx >= im ? rp |= SC : rp &= ~SC
          this.adr = pc
          cycle = FETCH1
          break

        // CPY
        case 0xCC: case 0xC0: case 0xC4:
          var d = (ry - im) & 0xff
          rp = d == 0 ? rp |= SZ : rp &= ~SZ
          rp = d >= 0x80 ? rp |= SN : rp &= ~SN
          rp = ry >= im ? rp |= SC : rp &= ~SC
          this.adr = pc
          cycle = FETCH1
          break

        // BIT
        case 0x2C: case 0x89: case 0x24:
          rp = (ra & im) == 0 ? rp |= SZ : rp &= ~SZ
          rp = (im & 0x80) != 0 ? rp |= SN : rp &= ~SN
          rp = (im & 0x40) != 0 ? rp |= SV : rp &= ~SV
          this.adr = pc
          cycle = FETCH1
          break

        // BCC
        case 0x90:
          if ((rp & SC) == 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // BCS
        case 0xB0:
          if ((rp & SC) != 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // BEQ
        case 0xF0:
          if ((rp & SZ) != 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // BNE
        case 0xD0: // bne
          if ((rp & SZ) == 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // BMI
        case 0x30:
          if ((rp & SN) != 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break
        
        // BPL
        case 0x10:
          if ((rp & SN) == 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // BVS
        case 0x70:
          if ((rp & SV) != 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // BVC
        case 0x50:
          if ((rp & SV) == 0) {
            let rel = im < 0x80 ? im : im - 0x100
            pc = pc + rel
            this.adr = pc
          }
          cycle = FETCH1
          break

        // TAX
        case 0xAA:
          rx = ra
          rp = rx == 0 ? rp |= SZ : rp &= ~SZ
          rp = rx >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // TXA
        case 0x8A:
          ra = rx
          rp = ra == 0 ? rp |= SZ : rp &= ~SZ
          rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // TAY
        case 0xA8:
          ry = ra
          rp = ry == 0 ? rp |= SZ : rp &= ~SZ
          rp = ry >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // TYA
        case 0x98:
          ra = ry
          rp = ra == 0 ? rp |= SZ : rp &= ~SZ
          rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // TSX
        case 0xBA:
          rx = sp
          rp = rx == 0 ? rp |= SZ : rp &= ~SZ
          rp = rx >= 0x80 ? rp |= SN : rp &= ~SN
          ir = im
          cycle = FETCH2
          break

        // TXS
        case 0x9A:
          sp = rx
          ir = im
          cycle = FETCH2
          break

        // PHA
        case 0x48:
          this.data = ra
          this.write = 1
          this.adr = 0x100 + sp
          sp  = (sp - 1) & 0xff
          pc = pc - 1
          cycle = MEMOP
          break

        // PLA
        case 0x68:
          sp = (sp + 1) & 0xff
          this.adr = 0x100 + sp
          pc = pc - 1
          cycle = PULLA
          break

        // PHP
        case 0x08:
          rp |= SB
          rp |= SS
          this.data = rp
          this.write = 1
          this.adr = 0x100 + sp
          sp  = (sp - 1) & 0xff
          pc = pc - 1
          cycle = MEMOP
          break

        // PLP
        case 0x28:
          sp = (sp + 1) & 0xff
          this.adr = 0x100 + sp
          pc = pc - 1
          cycle = PULLP
          break

        // JMP
        case 0x4C: case 0x6C:
          pc = this.adr
          this.adr = pc
          cycle = FETCH1
          break

        // JSR
        case 0x20:
          this.data = pc >> 8
          this.adr = 0x100 + sp
          sp  = (sp - 1) & 0xff
          this.write = 1
          cycle = JSR0
          break

        // RTS
        case 0x60:
          sp = (sp + 1) & 0xff
          this.adr = 0x100 + sp
          cycle = RTS0
          break

        // RTI
        case 0x40:
          sp = (sp + 1) & 0xff
          this.adr = 0x100 + sp
          cycle = RTI0
          break

        // SEC
        case 0x38:
          rp |= SC
          ir = im
          cycle = FETCH2
          break

        // SED
        case 0xF8:
          rp |= SD
          ir = im
          cycle = FETCH2
          break

        // SEI
        case 0x78:
          rp |= SI
          ir = im
          cycle = FETCH2
          break

        // CLC
        case 0x18:
          rp &= ~SC
          ir = im
          cycle = FETCH2
          break

        // CLD
        case 0xd8:
          rp &= ~SD
          ir = im
          cycle = FETCH2
          break

        // CLI
        case 0x58:
          rp &= ~SI
          ir = im
          cycle = FETCH2
          break
        
        // CLV
        case 0xb8:
          rp &= ~SV
          ir = im
          cycle = FETCH2
          break

        // NOP
        case 0xEA:
          ir = im
          cycle = FETCH2
          break

        // BRK
        case 0x00:
          this.data = pc >> 8
          this.adr = 0x100 + sp
          sp  = (sp - 1) & 0xff
          this.write = 1
          cycle = BRK0
          break
      }
      break

    case BRK0:
      this.data = pc & 0xff
      this.adr = 0x100 + sp
      sp  = (sp - 1) & 0xff
      this.write = 1
      cycle = BRK1
      break
      
    case BRK1:
      rp |= SS
      this.data = rp
      this.adr = 0x100 + sp
      sp  = (sp - 1) & 0xff
      this.write = 1
      cycle = BRK2
      break
      
    case BRK2:
      rp |= SI
      this.adr = 0xfffe
      this.write = 0
      cycle = BRK3
      break
      
    case BRK3:
      im = this.data
      this.adr = 0xffff
      cycle = BRK4
      break
      
    case BRK4:
      pc = (this.data << 8) | im
      this.adr = pc
      cycle = FETCH1
      break

    case PULLA:
      ra = this.data
      rp = ra == 0 ? rp |= SZ : rp &= ~SZ
      rp = ra >= 0x80 ? rp |= SN : rp &= ~SN
      this.adr = pc
      cycle = FETCH1
      break

    case PULLP:
      rp = this.data
      rp |= SB
      rp &= ~ SS
      this.adr = pc
      cycle = FETCH1
      break

    case JSR0:
      this.data = pc & 0xff
      this.adr = 0x100 + sp
      sp  = (sp - 1) & 0xff
      this.write = 1
      cycle = JSR1
      break

    case JSR1:
      pc = im
      this.adr = im
      this.write = 0
      cycle = FETCH1
      break
      
    case RTI0:
      rp = this.data
      sp = (sp + 1) & 0xff
      this.adr = 0x100 + sp
      cycle = RTI1
      break
      
    case RTI1:
      pc = this.data
      sp = (sp + 1) & 0xff
      this.adr = 0x100 + sp
      cycle = RTI2
      break
      
    case RTI2:
      pc = pc | (this.data << 8)
      this.adr = pc
      cycle = FETCH1
      break

    case RTS0:
      pc = this.data
      sp = (sp + 1) & 0xff
      this.adr = 0x100 + sp
      cycle = RTS1
      break

    case RTS1:
      pc = 1 + (pc | (this.data << 8))
      this.adr = pc
      cycle = FETCH1
      break

    case MEMOP:
      this.write = 0
      this.adr = pc
      cycle = FETCH1
      break

  }

  if (this.reset) {
    cycle = RESET0
    this.reset = false
  }

}

// debugger memory access
CPU.inject = function(code) {
  return eval(code)
}

export default CPU