import {
  BusinessRuleViolationError,
  ExerciseIdVO,
  MuscleIdVO,
  type Result,
  type ValidationError,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import { ExerciseName } from "../value-objects/exercise-name";

export interface ExerciseProps {
  id: ExerciseIdVO;
  name: ExerciseName;
  primaryMuscleId: MuscleIdVO;
  secondaryMuscleIds: MuscleIdVO[];
  isCustom: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseParams {
  name: string;
  primaryMuscleId: number;
  secondaryMuscleIds?: number[];
  isCustom: boolean;
  createdBy?: string;
}

/**
 * Exercise entity
 * Represents a training exercise with associated muscle groups
 */
export class Exercise {
  private readonly _id: ExerciseIdVO;
  private _name: ExerciseName;
  private _primaryMuscleId: MuscleIdVO;
  private _secondaryMuscleIds: MuscleIdVO[];
  private readonly _isCustom: boolean;
  private readonly _createdBy?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ExerciseProps) {
    this._id = props.id;
    this._name = props.name;
    this._primaryMuscleId = props.primaryMuscleId;
    this._secondaryMuscleIds = props.secondaryMuscleIds;
    this._isCustom = props.isCustom;
    this._createdBy = props.createdBy;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(
    params: CreateExerciseParams,
  ): Result<Exercise, ValidationError | BusinessRuleViolationError> {
    // Validate name
    const nameResult = ExerciseName.create(params.name);
    if (nameResult.isErr()) {
      return err(nameResult.error);
    }

    // Validate primary muscle
    const primaryMuscleId = MuscleIdVO.create(params.primaryMuscleId);

    // Validate secondary muscles
    const secondaryMuscleIds: MuscleIdVO[] = [];
    if (params.secondaryMuscleIds) {
      for (const muscleId of params.secondaryMuscleIds) {
        secondaryMuscleIds.push(MuscleIdVO.create(muscleId));
      }
    }

    // Business rule: secondary muscles cannot include primary muscle
    if (secondaryMuscleIds.some((id) => id.equals(primaryMuscleId))) {
      return err(
        new BusinessRuleViolationError(
          "Secondary muscles cannot include the primary muscle",
          {
            primaryMuscleId: params.primaryMuscleId,
            secondaryMuscleIds: params.secondaryMuscleIds,
          },
        ),
      );
    }

    // Business rule: custom exercises must have a creator
    if (params.isCustom && !params.createdBy) {
      return err(
        new BusinessRuleViolationError("Custom exercises must have a creator", {
          isCustom: params.isCustom,
        }),
      );
    }

    const now = new Date();
    const exercise = new Exercise({
      id: ExerciseIdVO.generate(),
      name: nameResult.unwrap(),
      primaryMuscleId,
      secondaryMuscleIds,
      isCustom: params.isCustom,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    return ok(exercise);
  }

  public static reconstitute(props: ExerciseProps): Exercise {
    return new Exercise(props);
  }

  // Getters
  get id(): ExerciseIdVO {
    return this._id;
  }

  get name(): ExerciseName {
    return this._name;
  }

  get primaryMuscleId(): MuscleIdVO {
    return this._primaryMuscleId;
  }

  get secondaryMuscleIds(): MuscleIdVO[] {
    return [...this._secondaryMuscleIds];
  }

  get isCustom(): boolean {
    return this._isCustom;
  }

  get createdBy(): string | undefined {
    return this._createdBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Domain methods
  public updateName(name: string): Result<void, ValidationError> {
    const nameResult = ExerciseName.create(name);
    if (nameResult.isErr()) {
      return err(nameResult.error);
    }

    this._name = nameResult.unwrap();
    this._updatedAt = new Date();
    return ok(undefined);
  }

  public updateMuscleGroups(
    primaryMuscleId: number,
    secondaryMuscleIds: number[],
  ): Result<void, BusinessRuleViolationError> {
    const newPrimaryMuscleId = MuscleIdVO.create(primaryMuscleId);
    const newSecondaryMuscleIds = secondaryMuscleIds.map((id) =>
      MuscleIdVO.create(id),
    );

    // Business rule: secondary muscles cannot include primary muscle
    if (newSecondaryMuscleIds.some((id) => id.equals(newPrimaryMuscleId))) {
      return err(
        new BusinessRuleViolationError(
          "Secondary muscles cannot include the primary muscle",
          { primaryMuscleId, secondaryMuscleIds },
        ),
      );
    }

    this._primaryMuscleId = newPrimaryMuscleId;
    this._secondaryMuscleIds = newSecondaryMuscleIds;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  public involvesMuscle(muscleId: MuscleIdVO): boolean {
    return (
      this._primaryMuscleId.equals(muscleId) ||
      this._secondaryMuscleIds.some((id) => id.equals(muscleId))
    );
  }
}
