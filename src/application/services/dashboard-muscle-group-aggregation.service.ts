import type {
  DashboardDataDto,
  WeeklyUserMuscleVolumeDto,
} from "../query/dashboard/dto";

/**
 * ダッシュボードデータの筋肉グループ統合処理を行うアプリケーションサービス
 * クリーンアーキテクチャの原則に従い、ビジネスロジックをアプリケーション層で実装
 */
export class DashboardMuscleGroupAggregationService {
  /**
   * 筋肉グループ6（Hip & Glutes）と7（Legs）を統合して「脚（Legs）」として返す
   * @param dto 元のダッシュボードデータDTO
   * @param preferredLocale 言語設定（ja, en等）
   * @returns 筋肉グループが統合されたダッシュボードデータDTO
   */
  aggregateLegMuscleGroups(
    dto: DashboardDataDto,
    preferredLocale?: string,
  ): DashboardDataDto {
    const targetMuscleGroupIds = [6, 7]; // Hip & Glutes, Legs
    const legsGroupId = 7; // 統合後のグループIDとして脚（Legs）を使用

    // 統合後のグループ名を既存の翻訳データから取得
    const legsGroupName = this.getLocalizedLegsGroupName(dto, preferredLocale);

    return {
      ...dto,
      currentWeekSummary: dto.currentWeekSummary
        ? {
            ...dto.currentWeekSummary,
            muscleVolumes: this.aggregateMuscleVolumes(
              dto.currentWeekSummary.muscleVolumes,
              targetMuscleGroupIds,
              legsGroupId,
              legsGroupName,
            ),
          }
        : undefined,
      historicalWeeklyMuscleVolumes: dto.historicalWeeklyMuscleVolumes
        ? this.aggregateMuscleVolumes(
            dto.historicalWeeklyMuscleVolumes,
            targetMuscleGroupIds,
            legsGroupId,
            legsGroupName,
          )
        : undefined,
    };
  }

  /**
   * 既存の翻訳データから適切な言語の「脚」グループ名を取得
   * @param dto ダッシュボードデータDTO
   * @param preferredLocale 言語設定
   * @returns 翻訳されたLegsグループ名
   */
  private getLocalizedLegsGroupName(
    dto: DashboardDataDto,
    preferredLocale?: string,
  ): string {
    // デフォルトのフォールバック値
    const defaultGroupName = "Legs";

    // 統合対象のmuscleGroupId 7（Legs）のデータを探す
    const allMuscleVolumeData = [
      ...(dto.currentWeekSummary?.muscleVolumes || []),
      ...(dto.historicalWeeklyMuscleVolumes || []),
    ];

    // muscleGroupId 7のデータから翻訳されたグループ名を取得
    const legsGroupData = allMuscleVolumeData.find(
      (mv) => mv.muscleGroupId === 7,
    );

    if (legsGroupData?.muscleGroupName) {
      return legsGroupData.muscleGroupName;
    }

    // データが存在しない場合のフォールバック処理
    // 日本語の場合は「脚」、その他は「Legs」を返す
    if (preferredLocale === "ja") {
      return "脚";
    }

    return defaultGroupName;
  }

  /**
   * 筋肉ボリュームデータの統合処理
   * @param muscleVolumes 元の筋肉ボリュームデータ配列
   * @param targetMuscleGroupIds 統合対象の筋肉グループID配列
   * @param aggregatedGroupId 統合後のグループID
   * @param aggregatedGroupName 統合後のグループ名
   * @returns 統合された筋肉ボリュームデータ配列
   */
  private aggregateMuscleVolumes(
    muscleVolumes: WeeklyUserMuscleVolumeDto[],
    targetMuscleGroupIds: number[],
    aggregatedGroupId: number,
    aggregatedGroupName: string,
  ): WeeklyUserMuscleVolumeDto[] {
    // 統合対象外のデータと統合対象のデータを分離
    const nonTargetData = muscleVolumes.filter(
      (mv) => !targetMuscleGroupIds.includes(mv.muscleGroupId || 0),
    );

    const targetData = muscleVolumes.filter((mv) =>
      targetMuscleGroupIds.includes(mv.muscleGroupId || 0),
    );

    // 週とユーザーでグループ化して統合
    const aggregatedMap = new Map<string, WeeklyUserMuscleVolumeDto>();

    for (const mv of targetData) {
      const key = `${mv.userId}_${mv.weekStart}`;

      if (aggregatedMap.has(key)) {
        // 既存データに加算
        const existing = aggregatedMap.get(key);
        if (!existing) continue;
        existing.volume += mv.volume;
        existing.setCount += mv.setCount;
        existing.e1rmSum += mv.e1rmSum;
        existing.e1rmCount += mv.e1rmCount;

        // 更新日時は最新のものを採用
        if (new Date(mv.updatedAt) > new Date(existing.updatedAt)) {
          existing.updatedAt = mv.updatedAt;
        }
      } else {
        // 新規作成（統合後のグループ情報で）
        aggregatedMap.set(key, {
          ...mv,
          muscleGroupId: aggregatedGroupId,
          muscleGroupName: aggregatedGroupName,
          // muscleIdとmuscleNameは統合後は意味を持たないためnull/undefinedにする
          muscleId: aggregatedGroupId * 100, // 便宜上のダミーID（レスポンスで使用されないため）
          muscleName: undefined,
        });
      }
    }

    // 統合されたデータを配列に変換
    const aggregatedData = Array.from(aggregatedMap.values());

    // 統合対象外のデータと統合されたデータを結合
    return [...nonTargetData, ...aggregatedData];
  }
}
