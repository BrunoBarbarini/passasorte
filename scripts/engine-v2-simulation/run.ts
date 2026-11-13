import { playGame, rng } from "./simulate.js";
import type { PlayerSpec, Scenario, Strategy } from "./simulate.js";

const GAMES = Number(process.env.GAMES ?? 3000);
const out: string[] = [];
const log = (s = "") => out.push(s);

function field(
  rand: () => number,
  n: number,
  mix: Strategy[],
  pos: [number, number],
  mov: [number, number],
): PlayerSpec[] {
  return Array.from({ length: n }, (_, i) => {
    const strategy = mix[i % mix.length] as Strategy;
    const auto = (["NONE", "LEFT", "RIGHT"] as const)[Math.floor(rand() * 3)] as PlayerSpec["auto"];
    return {
      id: `P${i + 1}`,
      positions: pos[0] + Math.floor(rand() * (pos[1] - pos[0] + 1)),
      movements: mov[0] + Math.floor(rand() * (mov[1] - mov[0] + 1)),
      strategy,
      auto: strategy === "PASSIVE" ? auto : "NONE",
    };
  });
}

function pct(x: number) {
  return (100 * x).toFixed(2) + "%";
}

// ---- 1. baseline: nobody moves => P(win) must equal the position share
{
  const sc: Scenario = { rounds: 10, cap: null, layout: "RANDOM" };
  const rand = rng(1);
  const base = field(rand, 12, ["PASSIVE"], [2, 10], [0, 0]).map((p) => ({
    ...p,
    auto: "NONE" as const,
  }));
  const wins = new Map<string, number>();
  const share = new Map<string, number>();
  const total = base.reduce((s, p) => s + p.positions, 0);
  base.forEach((p) => share.set(p.id, p.positions / total));
  for (let g = 0; g < GAMES * 4; g += 1) {
    const o = playGame(base, sc, 100 + g);
    wins.set(o.winnerId, (wins.get(o.winnerId) ?? 0) + 1);
  }
  let worst = 0;
  for (const p of base)
    worst = Math.max(
      worst,
      Math.abs((wins.get(p.id) ?? 0) / (GAMES * 4) - (share.get(p.id) as number)),
    );
  log(
    `## 1. Linha de base (ninguém se move)\n\nMaior diferença absoluta entre a chance de ganhar e a fatia de posições: **${(worst * 100).toFixed(2)} p.p.** em ${GAMES * 4} partidas (ruído esperado ~±1 p.p.).\n`,
  );
}

// ---- 2. mixed field: edge by strategy and by entry order
function mixed(sc: Scenario, label: string, seed: number) {
  const rand = rng(seed);
  const players = field(rand, 24, ["AGGRESSIVE", "HOARDER", "RANDOM", "PASSIVE"], [2, 10], [4, 16]);
  const wins = new Map<string, number>();
  const exp = new Map<string, number>();
  const total = players.reduce((s, p) => s + p.positions, 0);
  for (let g = 0; g < GAMES; g += 1) {
    const o = playGame(players, sc, 5000 + g);
    wins.set(o.winnerId, (wins.get(o.winnerId) ?? 0) + 1);
  }
  const by = new Map<Strategy, { w: number; sh: number; n: number }>();
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
    log(`| ${s} | ${e.n} | ${pct(e.w)} | ${pct(e.sh)} | ${(e.w / e.sh).toFixed(2)} |`);
  const half = players.length / 2;
  let early = 0,
    earlyShare = 0;
  players.forEach((p, i) => {
    if (i < half) {
      early += (wins.get(p.id) ?? 0) / GAMES;
      earlyShare += p.positions / total;
    }
  });
  log(
    `\nPrimeiros ${half} a entrar (escolhem posição primeiro): chance **${pct(early)}** com fatia de posições ${pct(earlyShare)}.\n`,
  );
}
log(
  "## 2. Campo misto (24 jogadores, 4 estratégias, 2–10 posições e 4–16 movimentos cada, 10 rodadas)\n",
);
mixed(
  { rounds: 10, cap: null, layout: "RANDOM" },
  "Sem limite por rodada (`maxMovementsPerRound = null`)",
  11,
);
mixed({ rounds: 10, cap: 3, layout: "RANDOM" }, "Com limite de 3 créditos por rodada", 11);

// ---- 3. credit split: 1 credit = 1 position OR 1 movement
function split(strategy: Strategy, cap: number | null, budget: number) {
  const sc: Scenario = { rounds: 10, cap, layout: "RANDOM" };
  const rows: string[] = [];
  for (const p of [2, 4, 6, 8, 10, 12, 14, 16, 18]) {
    const rand = rng(77);
    const others = field(
      rand,
      23,
      ["AGGRESSIVE", "HOARDER", "RANDOM", "PASSIVE"],
      [2, 10],
      [4, 16],
    );
    const focal: PlayerSpec = {
      id: "FOCAL",
      positions: p,
      movements: budget - p,
      strategy,
      auto: "NONE",
    };
    const players = [...others, focal];
    const total = players.reduce((s, x) => s + x.positions, 0);
    let w = 0;
    for (let g = 0; g < GAMES; g += 1)
      if (playGame(players, sc, 9000 + g).winnerId === "FOCAL") w += 1;
    rows.push(
      `| ${p} | ${budget - p} | ${pct(p / total)} | ${pct(w / GAMES)} | ${(w / GAMES / (p / total)).toFixed(2)} |`,
    );
  }
  log(
    `**${strategy}, ${cap === null ? "sem limite" : "limite " + cap + "/rodada"}** (orçamento de ${budget} créditos)\n\n| Posições | Movimentos | Fatia | Chance de ganhar | Chance/fatia |\n|---|---|---|---|---|\n${rows.join("\n")}\n`,
  );
}
log(
  "## 3. Como dividir 20 créditos entre posições e movimentos (1 crédito = 1 posição OU 1 movimento)\n",
);
split("AGGRESSIVE", null, 20);
split("HOARDER", null, 20);
split("HOARDER", 3, 20);

// ---- 4. R-21 head to head: same resources, only timing differs
function head(cap: number | null) {
  const sc: Scenario = { rounds: 10, cap, layout: "RANDOM" };
  const rand = rng(5);
  const others = field(rand, 22, ["RANDOM", "PASSIVE"], [2, 10], [4, 16]);
  const a: PlayerSpec = {
    id: "AGG",
    positions: 6,
    movements: 14,
    strategy: "AGGRESSIVE",
    auto: "NONE",
  };
  const h: PlayerSpec = {
    id: "HOA",
    positions: 6,
    movements: 14,
    strategy: "HOARDER",
    auto: "NONE",
  };
  const players = [...others, a, h];
  const total = players.reduce((s, x) => s + x.positions, 0);
  const w = { AGG: 0, HOA: 0 };
  for (let g = 0; g < GAMES * 2; g += 1) {
    const o = playGame(players, sc, 20000 + g).winnerId;
    if (o === "AGG") w.AGG += 1;
    if (o === "HOA") w.HOA += 1;
  }
  log(
    `| ${cap === null ? "sem limite" : cap + " por rodada"} | ${pct(6 / total)} | ${pct(w.AGG / (GAMES * 2))} | ${pct(w.HOA / (GAMES * 2))} |`,
  );
}
log(
  "## 4. R-21: mesma compra (6 posições + 14 movimentos), só o momento de gastar muda\n\n| Limite | Fatia de posições (cada um) | Gasta ao longo das rodadas | Guarda tudo para a última |\n|---|---|---|---|",
);
head(null);
head(3);
head(1);
log("");
console.log(out.join("\n"));
