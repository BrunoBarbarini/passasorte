# Engine V2 simulation

Fairness and R-21 (hoarding) experiments on the real `gameV2` engine. Parameters are experiment
settings, not product rules. Results: `docs/SIMULACAO_ENGINE_V2.md`.

```sh
node_modules/.bin/esbuild scripts/engine-v2-simulation/run.ts --bundle --platform=node --format=esm --outfile=/tmp/sim.mjs
GAMES=4000 node /tmp/sim.mjs   # about 5 minutes
```
