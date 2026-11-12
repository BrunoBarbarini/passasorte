/**
 * Entry and position-selection phases (DECISION-07..11, BR-049..051).
 *
 * 1. During entry each participant only declares COUNTS (positions, movements,
 *    autoAction); no specific position is reserved (CR-010, DECISION-10).
 * 2. When entries close, the bar size is the sum of all position credits
 *    (DECISION-09/10). The bar never grows to favour anyone (DECISION-11).
 * 3. Participants choose their exact positions in `entrySequence` order
 *    (DECISION-07/08). The last picker simply receives what is left.
 * 4. The match may only start when every position has an owner
 *    (`allocatedPositions == boardSize`, DECISION-09).
 *
 * Pure: no clock, no I/O. Atomic assignment of `entrySequence` and the pick
 * race are guaranteed by the application layer and the database (BR-010).
 */
import { assertValidBarSize, assertValidPosition } from "./circular-bar.js";
import { GameEngineError } from "./errors.js";
import { RANDOM_PURPOSE_AUTO_ALLOCATION, seededUnit } from "./randomness.js";
import type { AutoAction, ParticipantSeatV2 } from "./types.js";

export interface EntryDeclaration {
  readonly participantId: string;
  /** Server-assigned, unique, gapless 1..M, immutable once confirmed (DECISION-08). */
  readonly entrySequence: number;
  readonly positionCredits: number;
  readonly movementCredits: number;
  readonly autoAction: AutoAction;
}

export interface PositionPick {
  readonly participantId: string;
  readonly positions: readonly number[];
}

export interface PositionSelectionState {
  readonly size: number;
  /** Sorted by entrySequence. */
  readonly entries: readonly EntryDeclaration[];
  readonly picks: readonly PositionPick[];
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Validates the confirmed entries once the entry period is closed. */
export function assertValidEntries(entries: readonly EntryDeclaration[]): void {
  if (entries.length === 0) {
    throw new GameEngineError("INVALID_ENTRIES", "Não há participações confirmadas.");
  }
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.participantId.length === 0 || ids.has(entry.participantId)) {
      throw new GameEngineError(
        "INVALID_ENTRIES",
        "Identificadores de participante devem ser únicos e não vazios.",
      );
    }
    ids.add(entry.participantId);
    if (!isCount(entry.positionCredits) || !isCount(entry.movementCredits)) {
      throw new GameEngineError(
        "INVALID_ENTRIES",
        "Posições e movimentos devem ser inteiros não negativos.",
      );
    }
  }
  const sequences = entries.map((entry) => entry.entrySequence).sort((a, b) => a - b);
  sequences.forEach((sequence, index) => {
    if (sequence !== index + 1) {
      throw new GameEngineError(
        "INVALID_ENTRIES",
        "A ordem de entrada deve ser única e sem lacunas, começando em 1.",
      );
    }
  });
}

/** DECISION-09/10: board size = sum of all position credits acquired. */
export function computeBoardSize(entries: readonly EntryDeclaration[]): number {
  assertValidEntries(entries);
  const size = entries.reduce((total, entry) => total + entry.positionCredits, 0);
  assertValidBarSize(size);
  return size;
}

export function createPositionSelection(
  entries: readonly EntryDeclaration[],
): PositionSelectionState {
  const size = computeBoardSize(entries);
  return {
    size,
    entries: [...entries].sort((a, b) => a.entrySequence - b.entrySequence),
    picks: [],
  };
}

function pickOf(state: PositionSelectionState, participantId: string): PositionPick | undefined {
  return state.picks.find((pick) => pick.participantId === participantId);
}

function entryOf(state: PositionSelectionState, participantId: string): EntryDeclaration {
  const entry = state.entries.find((candidate) => candidate.participantId === participantId);
  if (entry === undefined) {
    throw new GameEngineError("UNKNOWN_PARTICIPANT", "Participante não pertence a esta partida.");
  }
  return entry;
}

/** Participant whose turn it is to choose positions, or null when everyone has chosen (DECISION-08). */
export function currentPicker(state: PositionSelectionState): EntryDeclaration | null {
  return (
    state.entries.find(
      (entry) => entry.positionCredits > 0 && pickOf(state, entry.participantId) === undefined,
    ) ?? null
  );
}

export function freePositions(state: PositionSelectionState): readonly number[] {
  const taken = new Set(state.picks.flatMap((pick) => pick.positions));
  const free: number[] = [];
  for (let position = 1; position <= state.size; position += 1) {
    if (!taken.has(position)) free.push(position);
  }
  return free;
}

function requirePickTurn(state: PositionSelectionState, participantId: string): EntryDeclaration {
  const entry = entryOf(state, participantId);
  const picker = currentPicker(state);
  if (picker === null || picker.participantId !== participantId) {
    throw new GameEngineError(
      "NOT_YOUR_PICK_TURN",
      "Ainda não é a sua vez de escolher posições. Quem entrou antes escolhe antes.",
    );
  }
  return entry;
}

/**
 * The current picker chooses EXACTLY the number of positions they bought, any
 * free positions, concentrated or scattered (DECISION-07). Exclusive: a taken
 * position is rejected (BR-009).
 */
export function pickPositions(
  state: PositionSelectionState,
  participantId: string,
  positions: readonly number[],
): PositionSelectionState {
  const entry = requirePickTurn(state, participantId);
  if (positions.length !== entry.positionCredits) {
    throw new GameEngineError(
      "WRONG_POSITION_COUNT",
      `Você precisa escolher exatamente ${entry.positionCredits} posições.`,
    );
  }
  const chosen = new Set<number>();
  const free = new Set(freePositions(state));
  for (const position of positions) {
    assertValidPosition(position, state.size);
    if (chosen.has(position)) {
      throw new GameEngineError("INVALID_POSITION", "Não repita a mesma posição.");
    }
    if (!free.has(position)) {
      throw new GameEngineError(
        "POSITION_UNAVAILABLE",
        "A posição selecionada não está mais disponível.",
      );
    }
    chosen.add(position);
  }
  return { ...state, picks: [...state.picks, { participantId, positions: [...positions] }] };
}

/**
 * Absent picker (CR-012, BR-053): the server allocates free positions at random
 * from the committed seed. Never used while the participant is present
 * (DECISION-07). Deterministic and auditable: Fisher-Yates over the free list.
 */
export function autoAllocatePositions(
  state: PositionSelectionState,
  participantId: string,
  sealedSeedHex: string,
): PositionSelectionState {
  const entry = requirePickTurn(state, participantId);
  const pool = [...freePositions(state)];
  const chosen: number[] = [];
  for (let draw = 0; draw < entry.positionCredits; draw += 1) {
    const unit = seededUnit(
      sealedSeedHex,
      RANDOM_PURPOSE_AUTO_ALLOCATION,
      entry.entrySequence * 1_000_003 + draw,
    );
    const index = Math.floor(unit * pool.length);
    chosen.push(pool.splice(index, 1)[0] as number);
  }
  chosen.sort((a, b) => a - b);
  return { ...state, picks: [...state.picks, { participantId, positions: chosen }] };
}

export function allocatedPositionCount(state: PositionSelectionState): number {
  return state.picks.reduce((total, pick) => total + pick.positions.length, 0);
}

/** DECISION-09: allocatedPositions == boardSize, i.e. EMPTY_POSITIONS = 0. */
export function isSelectionComplete(state: PositionSelectionState): boolean {
  return allocatedPositionCount(state) === state.size;
}

/** Builds the fixed seats the Game Engine needs; refuses to start with empty positions. */
export function toParticipantSeats(state: PositionSelectionState): ParticipantSeatV2[] {
  if (!isSelectionComplete(state)) {
    throw new GameEngineError(
      "SELECTION_INCOMPLETE",
      "A partida só pode começar quando todas as posições da barra tiverem dono.",
    );
  }
  return state.entries.map((entry) => ({
    participantId: entry.participantId,
    entrySequence: entry.entrySequence,
    positions: [...(pickOf(state, entry.participantId)?.positions ?? [])].sort((a, b) => a - b),
    movementBalance: entry.movementCredits,
    autoAction: entry.autoAction,
  }));
}
