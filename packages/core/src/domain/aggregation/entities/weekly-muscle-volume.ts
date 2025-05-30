import type {
  MuscleIdVO,
  UserIdVO,
} from "../../shared/value-objects/identifier";

export interface IWeeklyMuscleVolumeProps {
  userId: UserIdVO;
  muscleId: MuscleIdVO;
  weekIdentifier: string; // 例: "2023-W52"
  volume: number;
  calculatedAt: Date;
}

export class WeeklyMuscleVolume {
  readonly userId: UserIdVO;
  readonly muscleId: MuscleIdVO;
  readonly weekIdentifier: string;
  readonly volume: number;
  readonly calculatedAt: Date;

  constructor(props: IWeeklyMuscleVolumeProps) {
    // ここで基本的なバリデーションを行うことも可能
    if (props.volume < 0) {
      throw new Error("Volume cannot be negative.");
    }
    this.userId = props.userId;
    this.muscleId = props.muscleId;
    this.weekIdentifier = props.weekIdentifier;
    this.volume = props.volume;
    this.calculatedAt = props.calculatedAt;
  }

  // 必要に応じてメソッドを追加 (例: toDTO, equals など)
}
