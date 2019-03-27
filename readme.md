### Another 6502

Another 6502 implementation in Javascript.

Run it with docker:
```
docker-compose up
```

or manually with
```
yarn install --production=false
yarn run webpack
yarn run webpack-dev-server --host 0.0.0.0 --port 80
```

The sys.asm file contains the two procedures needed by MSBasic to communicate with the virtual terminal.
```
; monitor functions
MONRDKEY        := $BF00
MONCOUT         := $BFA0
```
https://github.com/mist64/msbasic

The sys file is watched by Webpack. The sys directory contains a pre-compiled version of the Tass64 assembler for Debian.

