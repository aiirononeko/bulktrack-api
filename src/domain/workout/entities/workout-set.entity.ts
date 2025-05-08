import { WorkoutSessionIdVO, ExerciseIdVO, WorkoutSetIdVO } from "../../shared/vo/identifier"; // パス階層変更
import { v7 as uuidv7 } from "uuid";

export interface WorkoutSetProps {
  id: WorkoutSetIdVO;
  sessionId: WorkoutSessionIdVO;
  exerciseId: ExerciseIdVO;
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: Date;
}

export interface WorkoutSetRawData {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: string;
}

export class WorkoutSet {
  readonly id: WorkoutSetIdVO;
  readonly sessionId: WorkoutSessionIdVO;
  readonly exerciseId: ExerciseIdVO;
  private _setNumber: number;
  private _reps?: number | null;
  private _weight?: number | null;
  private _notes?: string | null;
  private _performedAt: Date;

  private constructor(props: WorkoutSetProps) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.exerciseId = props.exerciseId;
    this._setNumber = props.setNumber;
    this._reps = props.reps;
    this._weight = props.weight;
    this._notes = props.notes;
    this._performedAt = props.performedAt;
  }

  public static create(props: Omit<WorkoutSetProps, 'id' | 'performedAt'> & { id?: WorkoutSetIdVO, performedAt?: Date }): WorkoutSet {
    if (props.setNumber <= 0) {
      throw new Error("Set number must be positive.");
    }
    const id = props.id || new WorkoutSetIdVO(uuidv7());
    const performedAt = props.performedAt || new Date();
    return new WorkoutSet({
      ...props,
      id,
      performedAt,
    });
  }

  public static fromPersistence(data: WorkoutSetRawData): WorkoutSet {
    return new WorkoutSet({
      id: new WorkoutSetIdVO(data.id),
      sessionId: new WorkoutSessionIdVO(data.sessionId),
      exerciseId: new ExerciseIdVO(data.exerciseId),
      setNumber: data.setNumber,
      reps: data.reps,
      weight: data.weight,
      notes: data.notes,
      performedAt: new Date(data.performedAt),
    });
  }

  get setNumber(): number { return this._setNumber; }
  get reps(): number | undefined | null { return this._reps; }
  get weight(): number | undefined | null { return this._weight; }
  get notes(): string | undefined | null { return this._notes; }
  get performedAt(): Date { return this._performedAt; }

  public toPrimitives(): WorkoutSetRawData {
    return {
      id: this.id.value,
      sessionId: this.sessionId.value,
      exerciseId: this.exerciseId.value,
      setNumber: this._setNumber,
      reps: this._reps,
      weight: this._weight,
      notes: this._notes,
      performedAt: this._performedAt.toISOString(),
    };
  }
}
