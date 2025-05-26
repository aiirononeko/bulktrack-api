import type { DashboardDataDto, WeeklyUserVolumeDto, WeeklyUserMuscleVolumeDto, WeeklyUserMetricDto } from '../query/dashboard/dto';
import { generateWeeklyDateRange } from '../utils/date-utils';
import type { DashboardRepository, MuscleGroupInfo } from '../../infrastructure/db/repository/dashboard-repository';

/**
 * ダッシュボードデータのデータ補完サービス
 * データがない期間を初期値（0）で埋める処理を担当
 */
export class DashboardDataCompletionService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}
  /**
   * 指定されたspan期間に基づいて、データがない週を初期値で補完します
   * @param dto 元のダッシュボードデータDTO
   * @param span 期間指定文字列（例: "1w", "4w", "12w"）
   * @param userId ユーザーID
   * @param preferredLocale 優先言語
   * @returns 補完されたダッシュボードデータDTO
   */
  async completeWeeklyData(dto: DashboardDataDto, span: string, userId: string, preferredLocale?: string): Promise<DashboardDataDto> {
    const weekStartDates = generateWeeklyDateRange(span);

    return {
      ...dto,
      historicalWeeklyVolumes: this.completeWeeklyVolumes(dto.historicalWeeklyVolumes || [], weekStartDates, userId),
      historicalWeeklyMuscleVolumes: await this.completeWeeklyMuscleVolumes(dto.historicalWeeklyMuscleVolumes || [], weekStartDates, userId, preferredLocale),
      historicalMetrics: this.completeWeeklyMetrics(dto.historicalMetrics || [], weekStartDates, userId),
    };
  }

  /**
   * 週次ボリュームデータを補完します
   */
  private completeWeeklyVolumes(
    existingVolumes: WeeklyUserVolumeDto[],
    weekStartDates: string[],
    userId: string
  ): WeeklyUserVolumeDto[] {
    const volumeMap = new Map<string, WeeklyUserVolumeDto>();
    
    // 既存データをマップに格納
    for (const volume of existingVolumes) {
      volumeMap.set(volume.weekStart, volume);
    }
    
    // 全期間分のデータを生成（データがない週は初期値）
    const completedVolumes: WeeklyUserVolumeDto[] = [];
    for (const weekStart of weekStartDates) {
      const existingVolume = volumeMap.get(weekStart);
      if (existingVolume) {
        completedVolumes.push(existingVolume);
      } else {
        completedVolumes.push({
          userId,
          weekStart,
          totalVolume: 0,
          avgSetVolume: 0,
          e1rmAvg: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    
    return completedVolumes.sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
  }

  /**
   * 週次筋肉ボリュームデータを補完します
   * 注意: この処理は筋肉グループの統合処理（DashboardMuscleGroupAggregationService）の後に実行されることを前提としています
   */
  private async completeWeeklyMuscleVolumes(
    existingMuscleVolumes: WeeklyUserMuscleVolumeDto[],
    weekStartDates: string[],
    userId: string,
    preferredLocale?: string
  ): Promise<WeeklyUserMuscleVolumeDto[]> {
    // すべての筋肉グループを取得
    const allMuscleGroups = await this.dashboardRepository.findAllMuscleGroups(preferredLocale);
    
    // 筋肉グループ6（Hip & Glutes）は筋肉グループ7（Legs）に統合されているため除外
    const filteredMuscleGroups = allMuscleGroups.filter(mg => mg.id !== 6);
    
    // 筋肉グループIDごとにデータを整理
    const muscleGroupMap = new Map<number, Map<string, WeeklyUserMuscleVolumeDto>>();
    const muscleGroupMetadata = new Map<number, { muscleName?: string; muscleGroupName?: string }>();

    for (const muscleVolume of existingMuscleVolumes) {
      if (muscleVolume.muscleGroupId === undefined || muscleVolume.muscleGroupId === null) continue;

      if (!muscleGroupMap.has(muscleVolume.muscleGroupId)) {
        muscleGroupMap.set(muscleVolume.muscleGroupId, new Map());
      }
      
      const weekMap = muscleGroupMap.get(muscleVolume.muscleGroupId)!;
      const existingData = weekMap.get(muscleVolume.weekStart);
      
      if (existingData) {
        // 同じ週に複数の筋肉データがある場合は集約
        existingData.volume += muscleVolume.volume;
        existingData.setCount += muscleVolume.setCount;
        existingData.e1rmSum += muscleVolume.e1rmSum;
        existingData.e1rmCount += muscleVolume.e1rmCount;
      } else {
        weekMap.set(muscleVolume.weekStart, { ...muscleVolume });
      }
      
      // メタデータを保存
      muscleGroupMetadata.set(muscleVolume.muscleGroupId, {
        muscleName: muscleVolume.muscleName,
        muscleGroupName: muscleVolume.muscleGroupName,
      });
    }

    // 全期間分のデータを生成 - 統合後の筋肉グループについて
    const completedMuscleVolumes: WeeklyUserMuscleVolumeDto[] = [];
    
    for (const muscleGroup of filteredMuscleGroups) {
      const weekMap = muscleGroupMap.get(muscleGroup.id) || new Map();
      const metadata = muscleGroupMetadata.get(muscleGroup.id);
      
      for (const weekStart of weekStartDates) {
        const existingData = weekMap.get(weekStart);
        if (existingData) {
          completedMuscleVolumes.push(existingData);
        } else {
          completedMuscleVolumes.push({
            userId,
            weekStart,
            muscleId: 0, // ダミー値
            muscleName: metadata?.muscleName || 'Unknown Muscle',
            muscleGroupId: muscleGroup.id,
            muscleGroupName: metadata?.muscleGroupName || muscleGroup.name,
            volume: 0,
            setCount: 0,
            e1rmSum: 0,
            e1rmCount: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    
    return completedMuscleVolumes.sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
  }

  /**
   * 週次メトリクスデータを補完します
   */
  private completeWeeklyMetrics(
    existingMetrics: WeeklyUserMetricDto[],
    weekStartDates: string[],
    userId: string
  ): WeeklyUserMetricDto[] {
    // メトリクスキーごとにデータを整理
    const metricKeyMap = new Map<string, Map<string, WeeklyUserMetricDto>>();
    const metricKeyMetadata = new Map<string, { metricUnit: string | null }>();

    for (const metric of existingMetrics) {
      if (!metricKeyMap.has(metric.metricKey)) {
        metricKeyMap.set(metric.metricKey, new Map());
      }
      
      const weekMap = metricKeyMap.get(metric.metricKey)!;
      weekMap.set(metric.weekStart, metric);
      
      // メタデータを保存
      metricKeyMetadata.set(metric.metricKey, {
        metricUnit: metric.metricUnit,
      });
    }

    // 全期間分のデータを生成
    const completedMetrics: WeeklyUserMetricDto[] = [];
    
    for (const [metricKey, weekMap] of metricKeyMap.entries()) {
      const metadata = metricKeyMetadata.get(metricKey);
      
      for (const weekStart of weekStartDates) {
        const existingData = weekMap.get(weekStart);
        if (existingData) {
          completedMetrics.push(existingData);
        } else {
          completedMetrics.push({
            userId,
            weekStart,
            metricKey,
            metricValue: 0,
            metricUnit: metadata?.metricUnit || null,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    
    return completedMetrics.sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
  }
}
