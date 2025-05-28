import { v7 as uuidv7 } from "uuid";
import { ExerciseIdVO, WorkoutSetIdVO } from "../../shared/vo/identifier"; // パス階層変更, WorkoutSessionIdVOを削除

export interface WorkoutSetProps {
  id: WorkoutSetIdVO;
  exerciseId: ExerciseIdVO;
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: Date;
  createdAt: Date;
  rpe?: number | null;
  restSec?: number | null;
}

export interface WorkoutSetRawData {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: string;
  createdAt: string;
  volume?: number;
  rpe?: number | null;
  restSec?: number | null;
}

export interface WorkoutSetUpdateProps {
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt?: Date;
  rpe?: number | null;
  restSec?: number | null;
}

export class WorkoutSet {
  readonly id: WorkoutSetIdVO;
  readonly exerciseId: ExerciseIdVO;
  private _setNumber: number;
  private _reps?: number | null;
  private _weight?: number | null;
  private _notes?: string | null;
  private _performedAt: Date;
  readonly createdAt: Date;
  private _rpe?: number | null;
  private _restSec?: number | null;

  private constructor(props: WorkoutSetProps) {
    this.id = props.id;
    this.exerciseId = props.exerciseId;
    this._setNumber = props.setNumber;
    this._reps = props.reps;
    this._weight = props.weight;
    this._notes = props.notes;
    this._performedAt = props.performedAt;
    this.createdAt = props.createdAt;
    this._rpe = props.rpe;
    this._restSec = props.restSec;
  }

  public static create(
    props: Omit<WorkoutSetProps, "id" | "performedAt" | "createdAt"> & {
      id?: WorkoutSetIdVO;
      performedAt?: Date;
      createdAt?: Date;
    },
  ): WorkoutSet {
    if (props.setNumber <= 0) {
      throw new Error("Set number must be positive.");
    }
    const id = props.id || new WorkoutSetIdVO(uuidv7());
    const performedAt = props.performedAt || new Date();
    const createdAt = props.createdAt || new Date();
    return new WorkoutSet({
      ...props,
      id,
      performedAt,
      createdAt,
    });
  }

  public static fromPersistence(data: WorkoutSetRawData): WorkoutSet {
    let createdAtDate: Date;
    const rawCreatedAt = data.createdAt;

    if (typeof rawCreatedAt === "string") {
      if (rawCreatedAt.toLowerCase() === "undefined") {
        console.warn(
          `[WorkoutSet.fromPersistence] Found "undefined" string for createdAt. WorkoutSet ID: ${data.id}. Using current date as fallback.`,
        );
        createdAtDate = new Date();
      } else {
        let parsedDate = new Date(rawCreatedAt);
        if (
          parsedDate.toString() === "Invalid Date" &&
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawCreatedAt)
        ) {
          console.warn(
            `[WorkoutSet.fromPersistence] Attempting to parse "${rawCreatedAt}" as UTC by adding 'T' and 'Z'. WorkoutSet ID: ${data.id}`,
          );
          parsedDate = new Date(`${rawCreatedAt.replace(" ", "T")}Z`);
        }

        if (parsedDate.toString() === "Invalid Date") {
          console.warn(
            `[WorkoutSet.fromPersistence] Invalid createdAt string from DB: "${rawCreatedAt}" for WorkoutSet ID: ${data.id}. Using current date as fallback.`,
          );
          createdAtDate = new Date();
        } else {
          createdAtDate = parsedDate;
        }
      }
    } else if (rawCreatedAt === null || rawCreatedAt === undefined) {
      console.warn(
        `[WorkoutSet.fromPersistence] createdAt is null or undefined in DB for WorkoutSet ID: ${data.id}. Using current date as fallback.`,
      );
      createdAtDate = new Date();
    } else {
      console.warn(
        `[WorkoutSet.fromPersistence] Unexpected type for createdAt from DB: ${typeof rawCreatedAt} (value: ${rawCreatedAt}) for WorkoutSet ID: ${data.id}. Using current date as fallback.`,
      );
      createdAtDate = new Date();
    }

    const performedAtDate = new Date(data.performedAt);
    if (Number.isNaN(performedAtDate.getTime())) {
      console.error(
        `[WorkoutSet.fromPersistence] Invalid performedAt string from DB: ${data.performedAt} for WorkoutSet ID: ${data.id}`,
      );
      throw new Error(
        `Failed to parse performedAt from persistence for WorkoutSet ID: ${data.id}. Value: "${data.performedAt}"`,
      );
    }

    return new WorkoutSet({
      id: new WorkoutSetIdVO(data.id),
      exerciseId: new ExerciseIdVO(data.exerciseId),
      setNumber: data.setNumber,
      reps: data.reps,
      weight: data.weight,
      notes: data.notes,
      performedAt: performedAtDate,
      createdAt: createdAtDate,
      rpe: data.rpe,
      restSec: data.restSec,
    });
  }

  public update(props: WorkoutSetUpdateProps): void {
    if (props.reps !== undefined) {
      this._reps = props.reps;
    }
    if (props.weight !== undefined) {
      this._weight = props.weight;
    }
    if (props.notes !== undefined) {
      this._notes = props.notes;
    }
    if (props.performedAt !== undefined) {
      // Consider adding validation for performedAt if necessary
      this._performedAt = props.performedAt;
    }
    if (props.rpe !== undefined) {
      // Ensure rpe is within valid range if applicable (e.g., 1-10)
      // This might be better handled by a Value Object or in the constructor/setter
      this._rpe = props.rpe;
    }
    if (props.restSec !== undefined) {
      this._restSec = props.restSec;
    }
  }

  get setNumber(): number {
    return this._setNumber;
  }
  get reps(): number | undefined | null {
    return this._reps;
  }
  get weight(): number | undefined | null {
    return this._weight;
  }
  get notes(): string | undefined | null {
    return this._notes;
  }
  get performedAt(): Date {
    return this._performedAt;
  }
  get rpe(): number | undefined | null {
    return this._rpe;
  }
  get restSec(): number | undefined | null {
    return this._restSec;
  }

  get volume(): number | null {
    if (typeof this._reps === "number" && typeof this._weight === "number") {
      return this._reps * this._weight;
    }
    return null;
  }

  public toPrimitives(): WorkoutSetRawData {
    let performedAtISO: string;
    if (this._performedAt && !Number.isNaN(this._performedAt.getTime())) {
      performedAtISO = this._performedAt.toISOString();
    } else {
      console.error(
        "[WorkoutSet.toPrimitives] Invalid _performedAt date object for WorkoutSet ID:",
        this.id.value,
        "Value:",
        this._performedAt,
      );
      throw new RangeError(
        `[Debug] Invalid _performedAt in WorkoutSet id ${this.id.value}`,
      );
    }

    let createdAtISO: string;
    if (this.createdAt && !Number.isNaN(this.createdAt.getTime())) {
      createdAtISO = this.createdAt.toISOString();
    } else {
      console.error(
        "[WorkoutSet.toPrimitives] Invalid createdAt date object for WorkoutSet ID:",
        this.id.value,
        "Value:",
        this.createdAt,
      );
      throw new RangeError(
        `[Debug] Invalid createdAt in WorkoutSet id ${this.id.value}`,
      );
    }

    return {
      id: this.id.value,
      exerciseId: this.exerciseId.value,
      setNumber: this._setNumber,
      reps: this._reps,
      weight: this._weight,
      notes: this._notes,
      performedAt: performedAtISO,
      createdAt: createdAtISO,
      volume: this.volume === null ? undefined : this.volume,
      rpe: this._rpe,
      restSec: this._restSec,
    };
  }
}
