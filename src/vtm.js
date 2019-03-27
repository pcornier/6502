
const VTM = {}

let ctx
let IO
let buffer = ''

VTM.init = function(screen, io) {
  ctx = screen.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.font = '8px c64'
  IO = io
}

VTM.clock = function() {
  if (IO.serial_status == 1) {
    if (IO.serial_data == 13 || IO.serial_data == 101) {
      buffer += '\n'
    }
    else if (IO.serial_data >= 32 && IO.serial_data < 0x80) {
      buffer += String.fromCharCode(IO.serial_data)
    }
    IO.serial_status = 0
  }
  if (window.KC && IO.serial_status == 0) {
    if (window.KC < 32) {
      IO.serial_data = window.KC
    }
    else {
      IO.serial_data = window.KD.charCodeAt(0)
    }
    buffer += window.KD
    IO.serial_status = 2
    window.KC = false

    if (buffer.split('\n').length > 30) {
      var lines = buffer.split('\n')
      lines.shift()
      buffer = lines.join('\n')
    }
  }
}

VTM.update = function() {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = '#fff'
  let lines = buffer.split('\n')
  let y = 8
  for(var l of lines) {
    ctx.fillText(l, 0, y)
    y += 8
  }
}

export default VTM
