import { Identifier } from "@bulktrack/shared-kernel";

export class ExerciseId extends Identifier {
  static create(value: string): ExerciseId {
    return new ExerciseId(value);
  }
}

export class ExerciseName {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("Exercise name cannot be empty");
    }
  }

  getValue(): string {
    return this.value;
  }
}

export class ExerciseTranslation {
  constructor(
    public readonly locale: string,
    public readonly name: string,
  ) {}
}

export class ExerciseMuscle {
  constructor(
    public readonly muscleId: string,
    public readonly relativeTensionRatio: number,
  ) {
    if (relativeTensionRatio < 0 || relativeTensionRatio > 1) {
      throw new Error("Relative tension ratio must be between 0 and 1");
    }
  }
}

export class Exercise {
  constructor(
    private readonly id: ExerciseId,
    private readonly canonicalName: ExerciseName,
    private readonly isCompound: boolean,
    private readonly translations: ExerciseTranslation[],
    private readonly muscles: ExerciseMuscle[],
  ) {}

  getId(): ExerciseId {
    return this.id;
  }

  getCanonicalName(): string {
    return this.canonicalName.getValue();
  }

  isCompoundExercise(): boolean {
    return this.isCompound;
  }

  getTranslations(): ExerciseTranslation[] {
    return [...this.translations];
  }

  getMuscles(): ExerciseMuscle[] {
    return [...this.muscles];
  }

  getTranslation(locale: string): string | undefined {
    const translation = this.translations.find((t) => t.locale === locale);
    return translation?.name;
  }

  static create(params: {
    id: string;
    canonicalName: string;
    isCompound: boolean;
    translations: ExerciseTranslation[];
    muscles: ExerciseMuscle[];
  }): Exercise {
    return new Exercise(
      ExerciseId.create(params.id),
      new ExerciseName(params.canonicalName),
      params.isCompound,
      params.translations,
      params.muscles,
    );
  }
}
