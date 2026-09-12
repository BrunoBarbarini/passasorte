/**
 * TASK-069 End-to-End Pilot Simulation.
 *
 * Exercises a full realistic PassaSorte lifecycle against a REAL local
 * Postgres (the same docker-compose database already validated manually
 * in this project): merchant -> location -> experience -> campaign
 * (through its documented state machine) -> game room -> position holds
 * -> participation -> movement commands -> game run + winner -> benefit
 * grant -> redemption -> notification -> audit logs -> outbox event.
 *
 * IMPORTANT — what this does and does NOT do:
 * - It writes directly via `@prisma/client`, using the SAME schema
 *   (prisma/schema.prisma) and state-machine values apps/api enforces,
 *   but it does NOT call apps/api's use cases/HTTP endpoints, and it does
 *   NOT re-implement the actual game/movement/winner-selection rules
 *   (CLAUDE.md #58: those rules are still explicitly undecided/pluggable
 *   — see packages/domain/src/game/*). Where a real algorithm would
 *   normally decide something (which position wins, how movement
 *   allowance is computed), this script picks the simplest value that
 *   satisfies the schema/state machine, and says so in a comment at that
 *   point — it is a REFERENTIAL INTEGRITY AND STATE-MACHINE exercise, not
 *   a business-rules test.
 * - It never touches Supabase Auth — the User row it creates has a
 *   synthetic supabaseUserId, since no real Supabase Auth user is created
 *   by this script.
 * - Every row it creates has "pilot-simulation" in an identifying field
 *   (merchant legalName / user email) so it is trivial to find and
 *   delete afterwards; run with `--cleanup` to delete everything this
 *   script itself created (matched by that marker), instead of running
 *   the simulation again.
 *
 * Requires `tsx` at the repo root (added to package.json devDependencies
 * in this same batch — run `pnpm install` yourself, not via this
 * session). Requires the local docker-compose Postgres running and
 * migrated (`docker compose -f infrastructure/docker/docker-compose.yml
 * up -d && npx prisma migrate deploy --schema prisma/schema.prisma`),
 * with `.env` sourced into the shell.
 *
 * Usage (from repo root):
 *   npx tsx scripts/pilot-simulation/run.ts
 *   npx tsx scripts/pilot-simulation/run.ts --cleanup
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const MARKER = "pilot-simulation";
const prisma = new PrismaClient();

function log(step: string, detail?: unknown) {
  console.log(`[pilot-simulation] ${step}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
}

async function cleanup() {
  log("cleanup: locating pilot-simulation rows via marker");
  const users = await prisma.user.findMany({ where: { email: { contains: MARKER } } });
  const merchants = await prisma.merchant.findMany({ where: { legalName: { contains: MARKER } } });

  for (const user of users) {
    // Cascades (see schema.prisma onDelete: Cascade/Restrict) handle most
    // child rows; Restrict relations (Participation, BenefitAccount) are
    // deleted explicitly first, deepest-first.
    const participations = await prisma.participation.findMany({ where: { userId: user.id } });
    for (const p of participations) {
      await prisma.movementCommandLog.deleteMany({ where: { participationId: p.id } });
      await prisma.winner.deleteMany({ where: { participationId: p.id } });
    }
    await prisma.participation.deleteMany({ where: { userId: user.id } });

    const benefitAccount = await prisma.benefitAccount.findUnique({ where: { userId: user.id } });
    if (benefitAccount) {
      await prisma.benefitRedemption.deleteMany({ where: { accountId: benefitAccount.id } });
      await prisma.benefitLedgerEntry.deleteMany({ where: { accountId: benefitAccount.id } });
      await prisma.benefitAccount.delete({ where: { id: benefitAccount.id } });
    }

    await prisma.user.delete({ where: { id: user.id } }); // cascades notifications, profile, roles
  }

  for (const merchant of merchants) {
    const experiences = await prisma.experience.findMany({ where: { merchantId: merchant.id } });
    for (const experience of experiences) {
      const campaigns = await prisma.campaign.findMany({ where: { experienceId: experience.id } });
      for (const campaign of campaigns) {
        const rooms = await prisma.gameRoom.findMany({ where: { campaignId: campaign.id } });
        for (const room of rooms) {
          const gameRun = await prisma.gameRun.findUnique({ where: { roomId: room.id } });
          if (gameRun) {
            await prisma.winner.deleteMany({ where: { gameRunId: gameRun.id } });
            await prisma.gameRun.delete({ where: { id: gameRun.id } });
          }
          await prisma.positionHold.deleteMany({ where: { roomId: room.id } });
          await prisma.gameRoom.delete({ where: { id: room.id } });
        }
        await prisma.campaign.delete({ where: { id: campaign.id } });
      }
      await prisma.experience.delete({ where: { id: experience.id } });
    }
    await prisma.merchantLocation.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }

  await prisma.auditLog.deleteMany({ where: { metadata: { path: ["marker"], equals: MARKER } } });
  await prisma.outboxEvent.deleteMany({ where: { payload: { path: ["marker"], equals: MARKER } } });

  log("cleanup: done", { usersDeleted: users.length, merchantsDeleted: merchants.length });
}

async function run() {
  const suffix = randomUUID().slice(0, 8);

  // --- Partner + Catalog ----------------------------------------------
  log("creating merchant + location");
  const merchant = await prisma.merchant.create({
    data: {
      legalName: `Pilot Simulation LTDA ${suffix} (${MARKER})`,
      displayName: "Pilot Simulation Store",
      status: "ACTIVE",
      locations: {
        create: {
          label: "Loja Piloto",
          addressLine1: "Rua Exemplo, 100",
          city: "São Paulo",
          state: "SP",
          postalCode: "01000-000",
          country: "BR",
        },
      },
    },
  });

  log("creating experience (DRAFT -> ACTIVE)");
  const experience = await prisma.experience.create({
    data: {
      merchantId: merchant.id,
      title: "Experiência Piloto",
      description: "Experiência criada pelo script de simulação end-to-end (TASK-069).",
      status: "DRAFT",
    },
  });
  await prisma.experience.update({ where: { id: experience.id }, data: { status: "ACTIVE" } });

  // --- Campaign state machine: DRAFT -> IN_REVIEW -> APPROVED ->
  //     SCHEDULED -> PUBLISHED -> ENDED (CLAUDE.md #7) --------------------
  log("walking campaign through its documented state machine");
  let campaign = await prisma.campaign.create({
    data: {
      merchantId: merchant.id,
      experienceId: experience.id,
      title: "Campanha Piloto",
      status: "DRAFT",
    },
  });
  for (const status of ["IN_REVIEW", "APPROVED", "SCHEDULED"] as const) {
    campaign = await prisma.campaign.update({ where: { id: campaign.id }, data: { status } });
  }
  campaign = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      // BR-002: frozen snapshot of the experience at publication time.
      experienceSnapshot: { title: experience.title, description: experience.description },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "campaign.published",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { marker: MARKER },
    },
  });
  await prisma.outboxEvent.create({
    data: {
      aggregateType: "Campaign",
      aggregateId: campaign.id,
      eventType: "campaign.published",
      payload: { marker: MARKER, campaignId: campaign.id },
    },
  });

  // --- Game room + a synthetic user participating ----------------------
  log("creating game room (DRAFT -> OPEN -> ENTRY_LOCKED -> RUNNING)");
  let room = await prisma.gameRoom.create({
    data: {
      campaignId: campaign.id,
      capacity: 10,
      // gameConfig/participationPackages/operationsConfig are opaque JSON
      // by design (CLAUDE.md #56/#58 — no global default) — the shapes
      // below are the minimum this script itself reads back, not a real
      // ruleset.
      gameConfig: { boardSize: 10, marker: MARKER },
      holdTtlMs: 60_000,
      participationPackages: [{ id: "standard", label: "Pacote Padrão" }],
      operationsConfig: { finalLockGracePeriodMs: 30_000, marker: MARKER },
      status: "DRAFT",
    },
  });
  room = await prisma.gameRoom.update({ where: { id: room.id }, data: { status: "OPEN" } });

  log("creating a pilot user + position hold + participation");
  const user = await prisma.user.create({
    data: {
      supabaseUserId: randomUUID(), // synthetic — no real Supabase Auth user backs this row.
      email: `pilot-${suffix}@${MARKER}.local`,
      profile: { create: { displayName: "Usuário Piloto" } },
    },
  });

  const hold = await prisma.positionHold.create({
    data: {
      roomId: room.id,
      position: 1,
      holderRef: user.id,
      status: "ACTIVE",
      heldAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  let participation = await prisma.participation.create({
    data: {
      roomId: room.id,
      userId: user.id,
      packageId: "standard",
      positions: [hold.position],
      status: "CREATED",
      movementAllowanceTotal: 3,
    },
  });
  await prisma.positionHold.update({ where: { id: hold.id }, data: { status: "COMMITTED" } });
  for (const status of ["RESERVED", "CONFIRMED", "ACTIVE"] as const) {
    participation = await prisma.participation.update({ where: { id: participation.id }, data: { status } });
  }

  room = await prisma.gameRoom.update({ where: { id: room.id }, data: { status: "ENTRY_LOCKED" } });
  room = await prisma.gameRoom.update({ where: { id: room.id }, data: { status: "RUNNING" } });

  // --- Movement commands (BR-026 replayable log). The direction/position
  // values here are illustrative — real movement rules are still TBD
  // (@passasorte/domain's movement.ts). ----------------------------------
  log("recording movement commands");
  for (let sequence = 1; sequence <= 2; sequence += 1) {
    await prisma.movementCommandLog.create({
      data: {
        roomId: room.id,
        participationId: participation.id,
        positionIndex: 0,
        direction: "FORWARD",
        sequence,
      },
    });
  }
  participation = await prisma.participation.update({
    where: { id: participation.id },
    data: { movementAllowanceUsed: 2 },
  });

  // --- Final lock + resolution ------------------------------------------
  log("locking room and resolving a game run");
  room = await prisma.gameRoom.update({
    where: { id: room.id },
    data: { status: "FINAL_LOCK", finalLockedAt: new Date() },
  });
  room = await prisma.gameRoom.update({ where: { id: room.id }, data: { status: "RESOLVING" } });

  const gameRun = await prisma.gameRun.create({
    data: {
      roomId: room.id,
      engineVersion: "pilot-simulation-v0", // not a real engine version — see file header.
      commitmentHash: randomUUID(),
      seed: randomUUID(),
      finalSorteZone: { zone: "A", marker: MARKER },
      steps: [{ step: 1, marker: MARKER }],
      resolvedAt: new Date(),
    },
  });

  await prisma.winner.create({
    data: {
      gameRunId: gameRun.id,
      participationId: participation.id,
      winningPosition: hold.position,
    },
  });

  participation = await prisma.participation.update({
    where: { id: participation.id },
    data: { status: "LOCKED" },
  });
  participation = await prisma.participation.update({
    where: { id: participation.id },
    data: { status: "RESOLVED" },
  });
  participation = await prisma.participation.update({ where: { id: participation.id }, data: { status: "WON" } });

  room = await prisma.gameRoom.update({ where: { id: room.id }, data: { status: "COMPLETED" } });

  // --- Benefit grant + redemption (TASK-057/TASK-058) --------------------
  log("granting and redeeming a benefit");
  const benefitAccount = await prisma.benefitAccount.create({ data: { userId: user.id } });
  const grantEntry = await prisma.benefitLedgerEntry.create({
    data: {
      accountId: benefitAccount.id,
      userId: user.id,
      type: "GRANT",
      amountMinorUnits: 1000,
      reason: "pilot-simulation winner grant",
      sourceRef: gameRun.id,
    },
  });
  await prisma.benefitLedgerEntry.create({
    data: {
      accountId: benefitAccount.id,
      userId: user.id,
      type: "REDEMPTION",
      amountMinorUnits: -1000,
      grantEntryId: grantEntry.id,
    },
  });
  await prisma.benefitRedemption.create({
    data: {
      accountId: benefitAccount.id,
      benefitId: grantEntry.id,
      amountMinorUnits: 1000,
    },
  });
  participation = await prisma.participation.update({ where: { id: participation.id }, data: { status: "COMPLETED" } });

  // --- Notification -------------------------------------------------------
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "GAME_WON",
      title: "Você ganhou!",
      body: "Parabéns, você venceu a Campanha Piloto.",
      data: { marker: MARKER, roomId: room.id },
    },
  });

  log("SUCCESS — full lifecycle completed without a referential-integrity or state-machine error", {
    merchantId: merchant.id,
    campaignId: campaign.id,
    roomId: room.id,
    userId: user.id,
    finalParticipationStatus: participation.status,
    finalRoomStatus: room.status,
  });
  log("run again with --cleanup to remove everything this script created");
}

async function main() {
  const cleanupMode = process.argv.includes("--cleanup");
  try {
    if (cleanupMode) {
      await cleanup();
    } else {
      await run();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[pilot-simulation] FAILED:", error);
  process.exitCode = 1;
});
