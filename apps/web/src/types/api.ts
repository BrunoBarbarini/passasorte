/**
 * Wire-shape types for the dashboard, independent of @passasorte/domain
 * (same reasoning as apps/mobile's src/types/api.ts: dates arrive as ISO
 * strings over HTTP, not Date instances, and this app should not import
 * runtime domain code across the HTTP boundary).
 */
export type RoomStatus =
  | "DRAFT"
  | "OPEN"
  | "ENTRY_LOCKED"
  | "RUNNING"
  | "FINAL_LOCK"
  | "RESOLVING"
  | "COMPLETED"
  | "CANCELLED";

export interface GameRoomView {
  id: string;
  campaignId: string;
  capacity: number;
  status: RoomStatus;
  createdAt: string;
  finalLockedAt: string | null;
}

export interface OutboxBacklog {
  pending: number;
}
