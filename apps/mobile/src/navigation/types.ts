export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  CampaignDetail: { campaignId: string };
  PositionSelection: { roomId: string };
  ParticipationConfirmation: { roomId: string; packageId: string; positions: number[] };
  LiveGame: { participationId: string };
  FinalLock: { participationId: string };
  Result: { participationId: string };
  Benefits: undefined;
};
