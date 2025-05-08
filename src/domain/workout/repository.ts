import type { WorkoutSession } from "./entity";
import type { WorkoutSessionIdVO, UserIdVO } from "../shared/vo/identifier";

export interface IWorkoutSessionRepository {
  findById(id: WorkoutSessionIdVO): Promise<WorkoutSession | null>;
  findByUserId(userId: UserIdVO): Promise<WorkoutSession[]>; // ユーザーのセッション履歴取得用（将来的に必要になる可能性）
  save(session: WorkoutSession): Promise<void>;
  // delete(id: WorkoutSessionIdVO): Promise<void>; // 必要に応じて追加
}
