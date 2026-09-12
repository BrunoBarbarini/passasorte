import { Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  CreateParticipationSchema,
  SubmitFinalMovementSchema,
  SubmitMovementSchema,
} from "@passasorte/api-contract";
import {
  AuthorizationError,
  ConflictError,
  ConfirmParticipationUseCase,
  CreateParticipationUseCase,
  NotFoundError,
  SubmitFinalMovementCommandUseCase,
  SubmitMovementCommandUseCase,
  ValidationError,
  type ParticipationRepository,
  type PositionHoldRepository,
  type IdempotencyPort,
  type RoomRepository,
} from "@passasorte/application";
import {
  findParticipationPackage,
  type AuthenticatedUser,
  type Participation,
} from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import {
  IDEMPOTENCY_PORT,
  PARTICIPATION_REPOSITORY,
  POSITION_HOLD_REPOSITORY,
  ROOM_REPOSITORY,
} from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/**
 * FR-027..FR-030 Participation + FR-037/FR-038 Movement + FR-039 Final
 * Lock. Every route requires authentication; confirming, reading, or
 * moving a participation additionally requires being its owner (no staff
 * override endpoint exists yet — not something the backlog asks for in
 * this phase).
 */
@Controller()
@UseGuards(AuthGuard)
export class ParticipationsController {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(POSITION_HOLD_REPOSITORY) private readonly holdRepository: PositionHoldRepository,
    @Inject(PARTICIPATION_REPOSITORY)
    private readonly participationRepository: ParticipationRepository,
    @Inject(IDEMPOTENCY_PORT) private readonly idempotency: IdempotencyPort,
  ) {}

  @Post("rooms/:roomId/participations")
  async create(
    @Param("roomId") roomId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Participation> {
    const input = parseWithSchema(CreateParticipationSchema, body);

    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", roomId);
    }
    const selectedPackage = findParticipationPackage(room.participationPackages, input.packageId);
    if (!selectedPackage) {
      throw new NotFoundError("ParticipationPackage", input.packageId);
    }

    // FR-023/024/026: a participant must already hold every requested
    // position (via POST /rooms/:roomId/holds) before a participation can
    // be created for it — this is wiring, not an invented business rule:
    // it keeps "select -> hold -> participate -> confirm" as the only
    // path into a room.
    const now = new Date();
    for (const position of input.positions) {
      const hold = await this.holdRepository.findActiveHold(roomId, position, now);
      if (!hold || hold.holderRef !== user.user.id) {
        throw new ConflictError(
          `É preciso reservar a posição ${position} antes de criar a participação.`,
        );
      }
    }

    return new CreateParticipationUseCase(this.participationRepository).execute({
      roomId,
      userId: user.user.id,
      package: selectedPackage,
      positions: input.positions,
    });
  }

  @Post("participations/:id/confirm")
  async confirm(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Participation> {
    await this.requireOwnedParticipation(id, user);
    return new ConfirmParticipationUseCase(
      this.participationRepository,
      this.holdRepository,
    ).execute({
      participationId: id,
    });
  }

  @Get("participations/:id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Participation> {
    return this.requireOwnedParticipation(id, user);
  }

  @Get("rooms/:roomId/participations/me")
  listMine(
    @Param("roomId") roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<readonly Participation[]> {
    return this.participationRepository.listByUserAndRoom(user.user.id, roomId);
  }

  @Post("participations/:id/movements")
  async submitMovement(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.requireOwnedParticipation(id, user);
    if (!idempotencyKey) {
      throw new ValidationError("O cabeçalho Idempotency-Key é obrigatório.", {
        field: "Idempotency-Key",
      });
    }
    const input = parseWithSchema(SubmitMovementSchema, body);
    return new SubmitMovementCommandUseCase(this.participationRepository, this.idempotency).execute(
      {
        participationId: id,
        command: {
          participationId: id,
          positionIndex: input.positionIndex,
          direction: input.direction,
          sequence: input.sequence,
        },
        idempotencyKey,
      },
    );
  }

  @Post("participations/:id/final-movement")
  async submitFinalMovement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Participation> {
    await this.requireOwnedParticipation(id, user);
    const input = parseWithSchema(SubmitFinalMovementSchema, body);
    return new SubmitFinalMovementCommandUseCase(
      this.roomRepository,
      this.participationRepository,
    ).execute({
      participationId: id,
      commands: input.commands.map((c) => ({
        participationId: id,
        positionIndex: c.positionIndex,
        direction: c.direction,
        sequence: c.sequence,
      })),
      atSequence: input.atSequence,
    });
  }

  private async requireOwnedParticipation(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Participation> {
    const participation = await this.participationRepository.findById(id);
    if (!participation) {
      throw new NotFoundError("Participation", id);
    }
    if (participation.userId !== user.user.id) {
      throw new AuthorizationError();
    }
    return participation;
  }
}
