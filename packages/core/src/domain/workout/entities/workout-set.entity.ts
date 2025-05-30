import { v7 as uuidv7 } from "uuid";
import {
  ExerciseIdVO,
  WorkoutSetIdVO,
} from "../../shared/value-objects/identifier";

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

  static create(props: {
    exerciseId: ExerciseIdVO;
    setNumber: number;
    reps?: number | null;
    weight?: number | null;
    notes?: string | null;
    performedAt?: Date;
    id?: WorkoutSetIdVO;
    rpe?: number | null;
    restSec?: number | null;
  }): WorkoutSet {
    // Validation
    if (props.setNumber < 1) {
      throw new Error("Set number must be at least 1");
    }
    if (props.reps !== undefined && props.reps !== null && props.reps < 0) {
      throw new Error("Reps cannot be negative");
    }
    if (
      props.weight !== undefined &&
      props.weight !== null &&
      props.weight < 0
    ) {
      throw new Error("Weight cannot be negative");
    }
    if (
      props.rpe !== undefined &&
      props.rpe !== null &&
      (props.rpe < 1 || props.rpe > 10)
    ) {
      throw new Error("RPE must be between 1 and 10");
    }
    if (
      props.restSec !== undefined &&
      props.restSec !== null &&
      props.restSec < 0
    ) {
      throw new Error("Rest seconds cannot be negative");
    }

    const now = new Date();
    return new WorkoutSet({
      id: props.id || new WorkoutSetIdVO(uuidv7()),
      exerciseId: props.exerciseId,
      setNumber: props.setNumber,
      reps: props.reps,
      weight: props.weight,
      notes: props.notes,
      performedAt: props.performedAt || now,
      createdAt: now,
      rpe: props.rpe,
      restSec: props.restSec,
    });
  }

  static reconstitute(rawData: WorkoutSetRawData): WorkoutSet {
    return new WorkoutSet({
      id: new WorkoutSetIdVO(rawData.id),
      exerciseId: new ExerciseIdVO(rawData.exerciseId),
      setNumber: rawData.setNumber,
      reps: rawData.reps,
      weight: rawData.weight,
      notes: rawData.notes,
      performedAt: new Date(rawData.performedAt),
      createdAt: new Date(rawData.createdAt),
      rpe: rawData.rpe,
      restSec: rawData.restSec,
    });
  }

  update(props: WorkoutSetUpdateProps): void {
    if (props.reps !== undefined) {
      if (props.reps !== null && props.reps < 0) {
        throw new Error("Reps cannot be negative");
      }
      this._reps = props.reps;
    }
    if (props.weight !== undefined) {
      if (props.weight !== null && props.weight < 0) {
        throw new Error("Weight cannot be negative");
      }
      this._weight = props.weight;
    }
    if (props.notes !== undefined) {
      this._notes = props.notes;
    }
    if (props.performedAt !== undefined) {
      this._performedAt = props.performedAt;
    }
    if (props.rpe !== undefined) {
      if (props.rpe !== null && (props.rpe < 1 || props.rpe > 10)) {
        throw new Error("RPE must be between 1 and 10");
      }
      this._rpe = props.rpe;
    }
    if (props.restSec !== undefined) {
      if (props.restSec !== null && props.restSec < 0) {
        throw new Error("Rest seconds cannot be negative");
      }
      this._restSec = props.restSec;
    }
  }

  toPrimitives(): WorkoutSetRawData {
    return {
      id: this.id.value,
      exerciseId: this.exerciseId.value,
      setNumber: this._setNumber,
      reps: this._reps,
      weight: this._weight,
      notes: this._notes,
      performedAt: this._performedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      volume: this.calculateVolume(),
      rpe: this._rpe,
      restSec: this._restSec,
    };
  }

  // Getters
  get setNumber(): number {
    return this._setNumber;
  }

  get reps(): number | null | undefined {
    return this._reps;
  }

  get weight(): number | null | undefined {
    return this._weight;
  }

  get notes(): string | null | undefined {
    return this._notes;
  }

  get performedAt(): Date {
    return this._performedAt;
  }

  get rpe(): number | null | undefined {
    return this._rpe;
  }

  get restSec(): number | null | undefined {
    return this._restSec;
  }

  calculateVolume(): number {
    if (!this._reps || !this._weight) return 0;
    return this._reps * this._weight;
  }
}
