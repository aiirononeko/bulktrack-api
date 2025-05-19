import type { IDashboardRepository, DashboardFilters } from "../../../domain/dashboard/repository";
import type { DashboardData } from "../../../domain/dashboard/entity";
import type { DashboardDataDto } from "./dto";
import { UserIdVO } from "../../../domain/shared/vo/identifier";

// Utility function to get the start of the current ISO week (Monday)
const getCurrentWeekStartDate = (): string => {
  const today = new Date();
  const day = today.getDay(); // Sunday - Saturday : 0 - 6
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD
};

export class GetDashboardDataQuery {
  constructor(
    public readonly userId: string,
    public readonly startDate?: string, // Optional: YYYY-MM-DD
    public readonly endDate?: string,   // Optional: YYYY-MM-DD
    public readonly metricKeys?: string[],
  ) {}
}

export class GetDashboardDataQueryHandler {
  constructor(private readonly dashboardRepository: IDashboardRepository) {}

  async execute(query: GetDashboardDataQuery): Promise<DashboardDataDto> {
    const userIdVo = new UserIdVO(query.userId);
    const currentWeekStart = getCurrentWeekStartDate();

    const filters: DashboardFilters = {
      userId: userIdVo,
      startDate: query.startDate,
      endDate: query.endDate,
      metricKeys: query.metricKeys,
      currentWeekStart: currentWeekStart, // For fetching current week data
    };

    // 1. Fetch current week summary
    const currentVolumeStatsPromise = this.dashboardRepository.findCurrentWeeklyUserVolume(
      userIdVo,
      currentWeekStart,
    );
    const currentMuscleVolumesPromise = this.dashboardRepository.findCurrentWeeklyUserMuscleVolumes(
      userIdVo,
      currentWeekStart,
    );

    // 2. Fetch historical data if date range is provided
    let historicalWeeklyVolumesPromise: Promise<DashboardData['historicalWeeklyVolumes']> = Promise.resolve(undefined);
    let historicalWeeklyMuscleVolumesPromise: Promise<DashboardData['historicalWeeklyMuscleVolumes']> = Promise.resolve(undefined);
    let historicalMetricsPromise: Promise<DashboardData['historicalMetrics']> = Promise.resolve(undefined);

    if (query.startDate && query.endDate) {
      const historicalFilters: DashboardFilters = {
        userId: userIdVo,
        startDate: query.startDate,
        endDate: query.endDate,
        metricKeys: query.metricKeys, // Pass metricKeys for historical metrics too
      };
      historicalWeeklyVolumesPromise = this.dashboardRepository.findWeeklyUserVolumes(historicalFilters);
      historicalWeeklyMuscleVolumesPromise = this.dashboardRepository.findWeeklyUserMuscleVolumes(historicalFilters);
      if (query.metricKeys && query.metricKeys.length > 0) {
        historicalMetricsPromise = this.dashboardRepository.findWeeklyUserMetrics(historicalFilters);
      }
    }

    const [
      currentVolumeStats,
      currentMuscleVolumes,
      historicalWeeklyVolumes,
      historicalWeeklyMuscleVolumes,
      historicalMetrics,
    ] = await Promise.all([
      currentVolumeStatsPromise,
      currentMuscleVolumesPromise,
      historicalWeeklyVolumesPromise,
      historicalWeeklyMuscleVolumesPromise,
      historicalMetricsPromise,
    ]);

    // Map domain entities to DTOs
    const dto: DashboardDataDto = {
      currentWeekSummary: {
        volumeStats: currentVolumeStats
          ? {
              userId: currentVolumeStats.userId.value,
              weekStart: currentVolumeStats.weekStart,
              totalVolume: currentVolumeStats.totalVolume,
              avgSetVolume: currentVolumeStats.avgSetVolume,
              e1rmAvg: currentVolumeStats.e1rmAvg,
              updatedAt: currentVolumeStats.updatedAt.toISOString(),
            }
          : null,
        muscleVolumes: currentMuscleVolumes.map(m => ({
          userId: m.userId.value,
          weekStart: m.weekStart,
          muscleId: m.muscleId.value,
          muscleName: m.muscleName,
          volume: m.volume,
          setCount: m.setCount,
          e1rmSum: m.e1rmSum,
          e1rmCount: m.e1rmCount,
          muscleGroupId: m.muscleGroupId,
          muscleGroupName: m.muscleGroupName,
          updatedAt: m.updatedAt.toISOString(),
        })),
      },
      historicalWeeklyVolumes: historicalWeeklyVolumes?.map(v => ({
        userId: v.userId.value,
        weekStart: v.weekStart,
        totalVolume: v.totalVolume,
        avgSetVolume: v.avgSetVolume,
        e1rmAvg: v.e1rmAvg,
        updatedAt: v.updatedAt.toISOString(),
      })),
      historicalWeeklyMuscleVolumes: historicalWeeklyMuscleVolumes?.map(m => ({
        userId: m.userId.value,
        weekStart: m.weekStart,
        muscleId: m.muscleId.value,
        muscleName: m.muscleName,
        volume: m.volume,
        setCount: m.setCount,
        e1rmSum: m.e1rmSum,
        e1rmCount: m.e1rmCount,
        muscleGroupId: m.muscleGroupId,
        muscleGroupName: m.muscleGroupName,
        updatedAt: m.updatedAt.toISOString(),
      })),
      historicalMetrics: historicalMetrics?.map(m => ({
        userId: m.userId.value,
        weekStart: m.weekStart,
        metricKey: m.metricKey,
        metricValue: m.metricValue,
        metricUnit: m.metricUnit,
        updatedAt: m.updatedAt.toISOString(),
      })),
    };

    return dto;
  }
}
