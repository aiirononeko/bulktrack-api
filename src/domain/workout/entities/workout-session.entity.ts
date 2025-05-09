import { UserIdVO, WorkoutSessionIdVO, MenuIdVO } from "../../shared/vo/identifier";
import type { WorkoutSetIdVO, ExerciseIdVO } from "../../shared/vo/identifier";
import { WorkoutSet, type WorkoutSetProps, type WorkoutSetRawData } from "./workout-set.entity";

export interface WorkoutSessionProps {
  id: WorkoutSessionIdVO;
  userId: UserIdVO;
  menuId?: MenuIdVO | null;
  startedAt: Date;
  finishedAt?: Date | null;
  sets?: WorkoutSet[];
}

export interface WorkoutSessionRawData {
  id: string;
  userId: string;
  menuId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  sets?: WorkoutSetRawData[];
}

export class WorkoutSession {
  readonly id: WorkoutSessionIdVO;
  readonly userId: UserIdVO;
  private _menuId?: MenuIdVO | null;
  private _startedAt: Date;
  private _finishedAt?: Date | null;
  private _sets: WorkoutSet[];

  private constructor(props: WorkoutSessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this._menuId = props.menuId;
    this._startedAt = props.startedAt;
    this._finishedAt = props.finishedAt;
    this._sets = props.sets || [];
  }

  public static create(props: {
    id: WorkoutSessionIdVO;
    userId: UserIdVO;
    menuId?: MenuIdVO | null;
    startedAt: Date;
    sets?: WorkoutSet[];
  }): WorkoutSession {
    return new WorkoutSession({
      id: props.id,
      userId: props.userId,
      menuId: props.menuId,
      startedAt: props.startedAt,
      sets: props.sets || [],
    });
  }

  public static fromPersistence(data: WorkoutSessionRawData): WorkoutSession {
    const sets = data.sets ? data.sets.map(WorkoutSet.fromPersistence) : [];
    const props: WorkoutSessionProps = {
      id: new WorkoutSessionIdVO(data.id),
      userId: new UserIdVO(data.userId),
      menuId: data.menuId ? new MenuIdVO(data.menuId) : null,
      startedAt: new Date(data.startedAt),
      finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
      sets: sets,
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

  get sets(): readonly WorkoutSet[] {
    return [...this._sets];
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

  public addSet(setCreationProps: Omit<WorkoutSetProps, 'id' | 'sessionId' | 'performedAt' | 'createdAt'> & { exerciseId: ExerciseIdVO, id?: WorkoutSetIdVO, performedAt?: Date, setNumber?: number | null }): WorkoutSet {
    if (this._finishedAt) {
      throw new Error("Cannot add sets to a finished session.");
    }

    let setNumberToUse: number;
    if (setCreationProps.setNumber != null && setCreationProps.setNumber > 0) {
      setNumberToUse = setCreationProps.setNumber;
    } else {
      const exerciseSets = this._sets.filter(s => s.exerciseId.equals(setCreationProps.exerciseId));
      if (exerciseSets.length > 0) {
        setNumberToUse = Math.max(...exerciseSets.map(s => s.setNumber)) + 1;
      } else {
        setNumberToUse = 1;
      }
    }

    const newSet = WorkoutSet.create({
      ...setCreationProps,
      sessionId: this.id,
      setNumber: setNumberToUse,
    });
    this._sets.push(newSet);
    return newSet;
  }

  public toPrimitives(): {
    id: string;
    userId: string;
    menuId?: string | null;
    startedAt: Date;
    finishedAt?: Date | null;
    sets: WorkoutSetRawData[];
  } {
    return {
      id: this.id.value,
      userId: this.userId.value,
      menuId: this._menuId?.value,
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
      sets: this._sets.map(s => s.toPrimitives()),
    };
  }
}
