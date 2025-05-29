import {
  BusinessRuleViolationError,
  type DomainEvent,
  ExerciseIdVO,
  type Result,
  type TrainingSetRecordedEvent,
  UserIdVO,
  ValidationError,
  WorkoutSetIdVO,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import { v7 as uuidv7 } from "uuid";
import { Reps } from "../value-objects/reps";
import { RPE } from "../value-objects/rpe";
import { Volume } from "../value-objects/volume";
import { Weight } from "../value-objects/weight";

export interface TrainingSetProps {
  id: WorkoutSetIdVO;
  userId: UserIdVO;
  exerciseId: ExerciseIdVO;
  weight: Weight;
  reps: Reps;
  rpe?: RPE;
  restSeconds?: number;
  notes?: string;
  performedAt: Date;
  createdAt: Date;
}

export interface CreateTrainingSetParams {
  userId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
  restSeconds?: number;
  notes?: string;
  performedAt?: Date;
}

/**
 * TrainingSet aggregate root
 * Represents a single set of an exercise performed during training
 */
export class TrainingSet {
  private readonly _id: WorkoutSetIdVO;
  private readonly _userId: UserIdVO;
  private readonly _exerciseId: ExerciseIdVO;
  private _weight: Weight;
  private _reps: Reps;
  private _rpe?: RPE;
  private _restSeconds?: number;
  private _notes?: string;
  private _performedAt: Date;
  private readonly _createdAt: Date;
  private _domainEvents: DomainEvent[] = [];

  private constructor(props: TrainingSetProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._exerciseId = props.exerciseId;
    this._weight = props.weight;
    this._reps = props.reps;
    this._rpe = props.rpe;
    this._restSeconds = props.restSeconds;
    this._notes = props.notes;
    this._performedAt = props.performedAt;
    this._createdAt = props.createdAt;
  }

  public static create(
    params: CreateTrainingSetParams,
  ): Result<TrainingSet, ValidationError | BusinessRuleViolationError> {
    // Validate weight
    const weightResult = Weight.create(params.weight);
    if (weightResult.isErr()) {
      return err(weightResult.error);
    }

    // Validate reps
    const repsResult = Reps.create(params.reps);
    if (repsResult.isErr()) {
      return err(repsResult.error);
    }

    // Validate RPE if provided
    let rpe: RPE | undefined;
    if (params.rpe !== undefined) {
      const rpeResult = RPE.create(params.rpe);
      if (rpeResult.isErr()) {
        return err(rpeResult.error);
      }
      rpe = rpeResult.unwrap();
    }

    // Validate rest seconds
    if (params.restSeconds !== undefined) {
      if (!Number.isInteger(params.restSeconds) || params.restSeconds < 0) {
        return err(
          new ValidationError(
            "Rest seconds must be a non-negative integer",
            "restSeconds",
            params.restSeconds,
          ),
        );
      }
    }

    // Validate notes
    if (params.notes && params.notes.length > 500) {
      return err(
        new ValidationError(
          "Notes cannot exceed 500 characters",
          "notes",
          params.notes,
        ),
      );
    }

    const now = new Date();
    const performedAt = params.performedAt || now;

    // Business rule: cannot log sets in the future
    if (performedAt > now) {
      return err(
        new BusinessRuleViolationError(
          "Cannot log training sets in the future",
          { performedAt: performedAt.toISOString(), now: now.toISOString() },
        ),
      );
    }

    const trainingSet = new TrainingSet({
      id: WorkoutSetIdVO.generate(),
      userId: new UserIdVO(params.userId),
      exerciseId: new ExerciseIdVO(params.exerciseId),
      weight: weightResult.unwrap(),
      reps: repsResult.unwrap(),
      rpe,
      restSeconds: params.restSeconds,
      notes: params.notes,
      performedAt,
      createdAt: now,
    });

    // Raise domain event
    trainingSet.addDomainEvent({
      eventId: uuidv7(),
      eventType: "TrainingSetRecorded",
      aggregateType: "TrainingSet",
      aggregateId: trainingSet._id.value,
      occurredAt: now,
      payload: {
        userId: params.userId,
        exerciseId: params.exerciseId,
        setId: trainingSet._id.value,
        weight: params.weight,
        reps: params.reps,
        rpe: params.rpe,
        volume: trainingSet.calculateVolume().value,
        performedAt,
      },
    } as TrainingSetRecordedEvent);

    return ok(trainingSet);
  }

  public static reconstitute(props: TrainingSetProps): TrainingSet {
    return new TrainingSet(props);
  }

  // Getters
  get id(): WorkoutSetIdVO {
    return this._id;
  }

  get userId(): UserIdVO {
    return this._userId;
  }

  get exerciseId(): ExerciseIdVO {
    return this._exerciseId;
  }

  get weight(): Weight {
    return this._weight;
  }

  get reps(): Reps {
    return this._reps;
  }

  get rpe(): RPE | undefined {
    return this._rpe;
  }

  get restSeconds(): number | undefined {
    return this._restSeconds;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  get performedAt(): Date {
    return this._performedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  // Domain methods
  public calculateVolume(): Volume {
    return Volume.calculate(this._weight, this._reps);
  }

  public updateWeight(weight: number): Result<void, ValidationError> {
    const weightResult = Weight.create(weight);
    if (weightResult.isErr()) {
      return err(weightResult.error);
    }

    this._weight = weightResult.unwrap();
    return ok(undefined);
  }

  public updateReps(reps: number): Result<void, ValidationError> {
    const repsResult = Reps.create(reps);
    if (repsResult.isErr()) {
      return err(repsResult.error);
    }

    this._reps = repsResult.unwrap();
    return ok(undefined);
  }

  public updateRPE(rpe: number | undefined): Result<void, ValidationError> {
    if (rpe === undefined) {
      this._rpe = undefined;
      return ok(undefined);
    }

    const rpeResult = RPE.create(rpe);
    if (rpeResult.isErr()) {
      return err(rpeResult.error);
    }

    this._rpe = rpeResult.unwrap();
    return ok(undefined);
  }

  public updateNotes(notes: string | undefined): Result<void, ValidationError> {
    if (notes && notes.length > 500) {
      return err(
        new ValidationError(
          "Notes cannot exceed 500 characters",
          "notes",
          notes,
        ),
      );
    }

    this._notes = notes;
    return ok(undefined);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
}
