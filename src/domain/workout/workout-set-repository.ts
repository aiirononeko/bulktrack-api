import type { UserIdVO } from "../shared/vo/identifier";
import type { WorkoutSet } from "./entities/workout-set.entity";
import type { WorkoutSetIdVO } from "../shared/vo/identifier";

export interface IWorkoutSetRepository {
  // Set related methods
  saveSet(set: WorkoutSet, userId: UserIdVO): Promise<void>; // Added userId for ownership
  findSetByIdAndUserId(id: WorkoutSetIdVO, userId: UserIdVO): Promise<WorkoutSet | null>; // Renamed and added userId
  updateSet(set: WorkoutSet, userId: UserIdVO): Promise<void>; // Added userId for ownership check during update
  deleteSet(id: WorkoutSetIdVO, userId: UserIdVO): Promise<void>; // Added userId for ownership check
}
 