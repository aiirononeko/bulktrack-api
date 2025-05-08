import type { IDashboardRepository } from "../../../domain/dashboard/repository";
import type { UserIdVO } from "../../../domain/shared/vo/identifier";
import type { DashboardPeriod } from "../../../domain/dashboard/vo";
import type { DashboardResponseDto } from "../../dto/dashboard.dto.ts";
// --- Helper DTO mappers (or this can be in a separate mapper file) ---
import type {
  CurrentWeekMuscleVolume,
  MuscleVolumeOverTime,
  ExerciseTotalVolume,
  UserProgressMetric,
  UnderstimulatedMuscle,
  UserDashboardBaseStats,
  CurrentWeekUserActivity,
} from "../../../domain/dashboard/repository";
import type {
  MuscleVolumeItemDto,
  WeeklyVolumeByMuscleItemDto,
  ExerciseVolumeItemDto as ExerciseVolumeItemDtoType,
  ProgressMetricItemDto,
  UnderstimulatedMuscleItemDto,
  CurrentWeekSummaryDto,
  PeriodSummaryDto,
} from "../../dto/dashboard.dto.ts";


// クエリの入力パラメータ
export interface GetDashboardQuery {
  userId: UserIdVO;
  period: DashboardPeriod;
}

export class GetDashboardHandler {
  constructor(private readonly dashboardRepository: IDashboardRepository) {}

  // TODO: このあたりの日付や週の識別子のロジックはドメインサービスやユーティリティに切り出すべき
  private getCurrentWeekIdentifier(): string {
    // 仮実装: 実際には現在の日付から ISO week (YYYY-Www) を計算する
    const now = new Date();
    const year = now.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
    const weekNumber = Math.ceil((dayOfYear + 1 + (startOfYear.getUTCDay() === 0 ? 6 : startOfYear.getUTCDay() -1) ) / 7) ; // Monday as first day of week for ISO 8601
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  }
  
  // --- Domain to DTO Mappers ---
  private mapBaseStatsToDto(stats: UserDashboardBaseStats | null, lastCalculatedAtOverride?: Date): Omit<DashboardResponseDto, 'userId' | 'currentWeekSummary' | 'periodSummary' | 'progressMetrics' | 'understimulatedMuscles'> {
    return {
      lastSessionId: stats?.lastSessionId?.toString() ?? null,
      deloadWarningSignal: stats?.deloadWarningSignal ?? false,
      lastCalculatedAt: (stats?.lastCalculatedAt ?? lastCalculatedAtOverride ?? new Date()).toISOString(),
    };
  }

  private mapCurrentWeekActivityToDto(activity: CurrentWeekUserActivity | null, volumes: CurrentWeekMuscleVolume[]): CurrentWeekSummaryDto {
    const totalVolume = volumes.reduce((sum, v) => sum + v.volume, 0);
    return {
      totalWorkouts: activity?.totalWorkouts ?? 0,
      currentStreak: activity?.currentStreak ?? 0,
      totalVolume: totalVolume,
      volumeByMuscle: volumes.map(v => ({
        muscleId: v.muscleId.toNumber(),
        name: v.muscleName,
        volume: v.volume,
      })),
    };
  }

  private mapPeriodSummaryToDto(
    period: DashboardPeriod,
    volumesOverTime: MuscleVolumeOverTime[],
    topExercises: ExerciseTotalVolume[]
  ): PeriodSummaryDto {
    let totalVolumeForPeriod = 0;

    const volumeByMuscleOverTimeDto: WeeklyVolumeByMuscleItemDto[] = volumesOverTime.map(m => {
      totalVolumeForPeriod += m.weeks.reduce((sum, w) => sum + w.volume, 0);
      return {
        muscleId: m.muscleId.toNumber(),
        name: m.muscleName,
        weeks: m.weeks.map(w => ({ week: w.week, volume: w.volume })),
      };
    });
    
    const numberOfWeeks = Number.parseInt(period.value.replace('w', ''), 10);
    const averageWeeklyVolume = numberOfWeeks > 0 && totalVolumeForPeriod > 0 ? totalVolumeForPeriod / numberOfWeeks : 0;

    const volumeTrend: PeriodSummaryDto['volumeTrend'] = 'N/A'; // Placeholder

    return {
      period: period.toString(),
      totalVolume: totalVolumeForPeriod, 
      averageWeeklyVolume: averageWeeklyVolume, 
      volumeTrend: volumeTrend, 
      volumeByMuscleOverTime: volumeByMuscleOverTimeDto,
      topExercisesByVolume: topExercises.map(e => ({
        exerciseId: e.exerciseId.toString(),
        name: e.exerciseName.toString(),
        totalVolume: e.totalVolume,
      })),
    };
  }

  private mapProgressMetricsToDto(metrics: UserProgressMetric[]): ProgressMetricItemDto[] {
    return metrics.map(m => ({
      metricKey: m.metricKey,
      value: m.value,
      unit: m.unit,
      recordedAt: m.recordedAt.toISOString(),
    }));
  }

  private mapUnderstimulatedMusclesToDto(muscles: UnderstimulatedMuscle[]): UnderstimulatedMuscleItemDto[] {
    return muscles.map(m => ({
      muscleId: m.muscleId.toNumber(),
      name: m.muscleName,
      lastTrained: m.lastTrained?.toISOString() ?? null,
    }));
  }

  async execute(query: GetDashboardQuery): Promise<DashboardResponseDto> {
    const { userId, period } = query;
    const currentWeekIdentifier = this.getCurrentWeekIdentifier();

    const [
      baseStats,
      currentWeekActivity,
      currentWeekMuscleVolumes,
      periodMuscleVolumesOverTime,
      periodTopExercises,
      userProgressMetrics,
      understimulatedMuscles,
    ] = await Promise.all([
      this.dashboardRepository.findBaseStats(userId),
      this.dashboardRepository.findCurrentWeekActivity(userId, currentWeekIdentifier),
      this.dashboardRepository.findCurrentWeekMuscleVolumes(userId, currentWeekIdentifier),
      this.dashboardRepository.findPeriodMuscleVolumesOverTime(userId, period),
      this.dashboardRepository.findPeriodTopExercisesByVolume(userId, period),
      this.dashboardRepository.findUserProgressMetrics(userId, period),
      this.dashboardRepository.findUnderstimulatedMuscles(userId, currentWeekIdentifier),
    ]);

    const baseDtoPart = this.mapBaseStatsToDto(baseStats, baseStats === null ? new Date() : undefined );
    
    const dto: DashboardResponseDto = {
      userId: userId.toString(), // Ensure userId is always set from the query
      ...baseDtoPart,
      currentWeekSummary: this.mapCurrentWeekActivityToDto(currentWeekActivity, currentWeekMuscleVolumes),
      periodSummary: this.mapPeriodSummaryToDto(period, periodMuscleVolumesOverTime, periodTopExercises),
      progressMetrics: this.mapProgressMetricsToDto(userProgressMetrics),
      understimulatedMuscles: this.mapUnderstimulatedMusclesToDto(understimulatedMuscles),
    };

    return dto;
  }
}
