import { LEVELS, playBlindGame } from "./simulate-temp.js";
import type { BlindPlayer, BlindStrategy } from "./simulate-temp.js";
import { rng } from "./simulate.js";
import type { Scenario } from "./simulate.js";

const GAMES = Number(process.env.GAMES ?? 3000);
const out: string[] = [];
const log = (s = "") => out.push(s);
const pct = (x: number) => (100 * x).toFixed(2) + "%";

function field(
  rand: () => number,
  n: number,
  mix: BlindStrategy[],
  pos: [number, number],
  mov: [number, number],
): BlindPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `P${i + 1}`,
    positions: pos[0] + Math.floor(rand() * (pos[1] - pos[0] + 1)),
    movements: mov[0] + Math.floor(rand() * (mov[1] - mov[0] + 1)),
    strategy: mix[i % mix.length] as BlindStrategy,
    auto: "NONE" as const,
  }));
}

// 1. level frequencies per round (casual field: nobody moves much)
{
  const sc: Scenario = { rounds: 10, cap: 3, layout: "RANDOM" };
  const rand = rng(3);
  const players = field(rand, 24, ["PROBE", "RANDOM", "PASSIVE", "HOARD_BLIND"], [2, 10], [4, 16]);
  const sum = Array.from({ length: 10 }, () => [0, 0, 0, 0, 0]);
  for (let g = 0; g < GAMES; g += 1) {
    const o = playBlindGame(players, sc, 300 + g);
    o.levels.forEach((row, r) =>
      row.forEach((c, l) => {
        (sum[r] as number[])[l] = ((sum[r] as number[])[l] as number) + c;
      }),
    );
  }
  log(
    `## 1. Frequência de cada nível por rodada (campo de 24, limite 3/rodada, ${GAMES} partidas)\n`,
  );
  log(
    `| Rodada | ${LEVELS.map((l) => l.replace("_", " ")).join(" | ")} |\n|---|---|---|---|---|---|`,
  );
  sum.forEach((row, r) => {
    const t = row.reduce((a, b) => a + b, 0);
    log(`| ${r + 1} | ${row.map((c) => pct(c / t)).join(" | ")} |`);
  });
  log("");
}

// 2. strategy vs casual, temperature only
function mixed(cap: number | null, label: string) {
  const sc: Scenario = { rounds: 10, cap, layout: "RANDOM" };
  const rand = rng(11);
  const players = field(
    rand,
    24,
    ["PROBE", "HOARD_BLIND", "HOARD_SCOUT", "RANDOM", "PASSIVE", "AGGRESSIVE"],
    [2, 10],
    [4, 16],
  );
  const wins = new Map<string, number>();
  const total = players.reduce((s, p) => s + p.positions, 0);
  for (let g = 0; g < GAMES; g += 1) {
    const o = playBlindGame(players, sc, 5000 + g);
    wins.set(o.winnerId, (wins.get(o.winnerId) ?? 0) + 1);
  }
  const by = new Map<string, { w: number; sh: number; n: number }>();
  for (const p of players) {
    const e = by.get(p.strategy) ?? { w: 0, sh: 0, n: 0 };
    e.w += (wins.get(p.id) ?? 0) / GAMES;
    e.sh += p.positions / total;
    e.n += 1;
    by.set(p.strategy, e);
  }
  log(
    `### ${label}\n\n| Estratégia | Jogadores | Chance de ganhar (soma) | Fatia de posições (soma) | Razão chance/fatia |\n|---|---|---|---|---|`,
  );
  for (const [s, e] of by)
    log(
      `| ${s}${s === "AGGRESSIVE" ? " (vê a posição da Sorte — referência)" : ""} | ${e.n} | ${pct(e.w)} | ${pct(e.sh)} | ${(e.w / e.sh).toFixed(2)} |`,
    );
  log("");
}
log("## 2. Estratégia contra jogador casual, só com temperatura\n");
mixed(null, "Sem limite por rodada");
mixed(3, "Limite de 3 por rodada");
mixed(1, "Limite de 1 por rodada");

// 3. R-21 head to head, temperature only
function head(cap: number | null) {
  const sc: Scenario = { rounds: 10, cap, layout: "RANDOM" };
  const rand = rng(5);
  const others = field(rand, 21, ["RANDOM", "PASSIVE"], [2, 10], [4, 16]);
  const mk = (id: string, strategy: BlindStrategy): BlindPlayer => ({
    id,
    positions: 6,
    movements: 14,
    strategy,
    auto: "NONE",
  });
  const players = [
    ...others,
    mk("PRB", "PROBE"),
    mk("HBL", "HOARD_BLIND"),
    mk("HSC", "HOARD_SCOUT"),
  ];
  const total = players.reduce((s, x) => s + x.positions, 0);
  const w: Record<string, number> = { PRB: 0, HBL: 0, HSC: 0 };
  const N = GAMES * 2;
  for (let g = 0; g < N; g += 1) {
    const o = playBlindGame(players, sc, 20000 + g).winnerId;
    if (o in w) w[o] = (w[o] as number) + 1;
  }
  log(
    `| ${cap === null ? "sem limite" : cap + " por rodada"} | ${pct(6 / total)} | ${pct((w.PRB as number) / N)} | ${pct((w.HBL as number) / N)} | ${pct((w.HSC as number) / N)} |`,
  );
}
log(
  "## 3. R-21 só com temperatura: mesma compra (6 posições + 14 movimentos), muda o jeito de gastar\n\n| Limite | Fatia (cada um) | Sonda e gasta ao longo das rodadas | Guarda tudo (às cegas) | Guarda, sonda 1 na penúltima |\n|---|---|---|---|---|",
);
head(null);
head(3);
head(1);
log("");
console.log(out.join("\n"));
