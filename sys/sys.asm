
* = $BF00
MONRDKEY:
- lda $ff00
  cmp #$2
  bne -     ; wait for data
  lda $ff01 ; read data
  rts

* = $BFA0
MONCOUT:
  sta $ff01
- lda $ff00 ; wait for send clear
  bne -
  rts
