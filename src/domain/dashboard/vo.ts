// src/domain/dashboard/vo.ts

// OpenAPIで定義された期間のenumに対応
export const VALID_DASHBOARD_PERIODS = ['1w', '4w', '12w', '24w'] as const;
export type DashboardPeriodValue = typeof VALID_DASHBOARD_PERIODS[number];

export class DashboardPeriod {
  readonly value: DashboardPeriodValue;

  private constructor(value: DashboardPeriodValue) {
    this.value = value;
  }

  public static create(value: string): DashboardPeriod {
    if (!VALID_DASHBOARD_PERIODS.includes(value as DashboardPeriodValue)) {
      throw new Error(`Invalid dashboard period: ${value}. Valid periods are ${VALID_DASHBOARD_PERIODS.join(', ')}.`);
    }
    return new DashboardPeriod(value as DashboardPeriodValue);
  }

  public toString(): string {
    return this.value;
  }

  // 必要に応じて期間を日数に変換するメソッドなどを追加可能
  // public toDays(): number {
  //   switch (this.value) {
  //     case '1w': return 7;
  //     case '4w': return 28;
  //     case '12w': return 84;
  //     case '24w': return 168;
  //     default:
  //       // 不変条件によりここは到達しないはず
  //       const _exhaustiveCheck: never = this.value;
  //       throw new Error(`Unknown period: ${_exhaustiveCheck}`);
  //   }
  // }
}

// 他のダッシュボード関連VOもここに追加していく
// 例:
// export type MuscleId = number;
// export type MuscleName = string;
// export type Volume = number;
// export type WeekIdentifier = string; // YYYY-Www
//
// export interface DatedMuscleVolume {
//   muscleId: MuscleId;
//   muscleName: MuscleName;
//   week: WeekIdentifier;
//   volume: Volume;
// }
//
// export interface CurrentWeekMuscleVolume {
//   muscleId: MuscleId;
//   muscleName: MuscleName;
//   volume: Volume;
// }
//
// // ... など
