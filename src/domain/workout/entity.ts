import { UserIdVO, WorkoutSessionIdVO, MenuIdVO } from "../shared/vo/identifier";

export interface WorkoutSessionProps {
  id: WorkoutSessionIdVO;
  userId: UserIdVO;
  menuId?: MenuIdVO | null; // メニューに基づかないセッションも許可
  startedAt: Date;
  finishedAt?: Date | null;
}

// Interface for raw data from persistence layer
export interface WorkoutSessionRawData {
  id: string;
  userId: string;
  menuId?: string | null;
  startedAt: string; // Typically ISO string from DB
  finishedAt?: string | null; // Typically ISO string from DB
  // createdAt, etc., if needed for rehydration logic, though usually handled by DB
}

export class WorkoutSession {
  readonly id: WorkoutSessionIdVO;
  readonly userId: UserIdVO;
  private _menuId?: MenuIdVO | null;
  private _startedAt: Date;
  private _finishedAt?: Date | null;

  private constructor(props: WorkoutSessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this._menuId = props.menuId;
    this._startedAt = props.startedAt;
    this._finishedAt = props.finishedAt;
  }

  public static create(props: {
    id: WorkoutSessionIdVO;
    userId: UserIdVO;
    menuId?: MenuIdVO | null;
    startedAt: Date;
  }): WorkoutSession {
    // ここで基本的なバリデーションを行うことも可能
    // 例: userId が空でないか、startedAt が未来の日付でないかなど
    return new WorkoutSession({
      id: props.id,
      userId: props.userId,
      menuId: props.menuId,
      startedAt: props.startedAt,
    });
  }

  public static fromPersistence(data: WorkoutSessionRawData): WorkoutSession {
    const props: WorkoutSessionProps = {
      id: new WorkoutSessionIdVO(data.id),
      userId: new UserIdVO(data.userId),
      menuId: data.menuId ? new MenuIdVO(data.menuId) : null,
      startedAt: new Date(data.startedAt),
      finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
    };
    return new WorkoutSession(props);
  }

  get menuId(): MenuIdVO | undefined | null {
    return this._menuId;
  }

  get startedAt(): Date {
    return this._startedAt;
  }

  get finishedAt(): Date | undefined | null {
    return this._finishedAt;
  }

  public finish(finishedAt: Date): void {
    if (this._finishedAt) {
      throw new Error("Session has already been finished.");
    }
    if (finishedAt < this._startedAt) {
      throw new Error("Finish time cannot be earlier than start time.");
    }
    this._finishedAt = finishedAt;
  }

  public toPrimitives(): {
    id: string;
    userId: string;
    menuId?: string | null;
    startedAt: Date;
    finishedAt?: Date | null;
  } {
    return {
      id: this.id.value,
      userId: this.userId.value,
      menuId: this._menuId?.value,
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
    };
  }
}
