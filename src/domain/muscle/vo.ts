// src/domain/muscle/vo.ts

// muscles.id (INTEGER PK) - 筋頭レベルのID
export type MuscleId = number;

// muscles.name (TEXT) - 筋頭レベルの名前
export type MuscleName = string;

// muscle_groups.id (INTEGER PK) - 筋群レベルのID
export type MuscleGroupId = number;

// muscle_groups.name (TEXT) - 筋群レベルの名前
export type MuscleGroupName = string;

/**
 * Represents a specific muscle (e.g., Pectoralis Major - Clavicular).
 */
export interface Muscle {
  id: MuscleId;
  name: MuscleName;
  muscleGroupId: MuscleGroupId;
}

/**
 * Represents a muscle group (e.g., Chest).
 */
export interface MuscleGroup {
  id: MuscleGroupId;
  name: MuscleGroupName;
}
