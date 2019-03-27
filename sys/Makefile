
ifeq (Android,$(shell uname -o))
	TASS = '64tass'
else
	TASS = './64tass'
endif

sys.bin: sys.asm
	$(TASS) -abc $^ -o $@ 