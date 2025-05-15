import type { WorkoutSession } from "./entities/workout-session.entity";
import type { WorkoutSessionIdVO, UserIdVO } from "../shared/vo/identifier";
import type { WorkoutSet } from "./entities/workout-set.entity";
import type { WorkoutSetIdVO } from "../shared/vo/identifier";

export interface IWorkoutSessionRepository {
  findById(id: WorkoutSessionIdVO): Promise<WorkoutSession | null>;
  findByUserId(userId: UserIdVO): Promise<WorkoutSession[]>; // ユーザーのセッション履歴取得用（将来的に必要になる可能性）
  save(session: WorkoutSession): Promise<void>;
  // delete(id: WorkoutSessionIdVO): Promise<void>; // 必要に応じて追加

  /**
   * 指定されたセッションIDに紐づく全てのワークアウトセットを取得します。
   * @param sessionId 取得対象のセッションID
   * @returns ワークアウトセットの配列。見つからない場合は空配列。
   */
  getSetsBySessionId(sessionId: WorkoutSessionIdVO): Promise<WorkoutSet[]>;

  findSetById(id: WorkoutSetIdVO): Promise<WorkoutSet | null>;
  updateSet(set: WorkoutSet): Promise<void>;
  deleteSet(id: WorkoutSetIdVO): Promise<void>;
}
 