import type { Result } from "@bulktrack/shared-kernel";
import type {
  MuscleGroupSeries,
  WeekPoint,
} from "../../usecases/dashboard/get-dashboard-query";

export interface DashboardRepository {
  getWeeklyVolume(
    userId: string,
    weekStart: Date,
    language: string,
  ): Promise<Result<WeekPoint | null, Error>>;

  getWeeklyVolumeTrend(
    userId: string,
    startDate: Date,
    endDate: Date,
    language: string,
  ): Promise<Result<WeekPoint[], Error>>;

  getMuscleGroupVolumes(
    userId: string,
    startDate: Date,
    endDate: Date,
    language: string,
  ): Promise<Result<MuscleGroupSeries[], Error>>;
}
