export interface IClarityScoreRepository {
  // Upserts on (userId, cycleKey): one score per ended cycle, last tap wins.
  record(userId: string, cycleKey: string, score: number): Promise<void>;
}
