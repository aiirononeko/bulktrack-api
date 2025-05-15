import type { IWorkoutSessionRepository } from "../../domain/workout/repository";
import { WorkoutSetIdVO, UserIdVO } from "../../domain/shared/vo/identifier";
import { type WorkoutSetUpdateProps, WorkoutSet } from "../../domain/workout/entities/workout-set.entity";
import { NotFoundError, AuthorizationError } from "../../app/errors";
// import type { UserIdVO } from "../../domain/shared/vo/identifier"; // If ownership check is needed

// It's good practice to define DTOs for use case inputs and outputs
export interface UpdateWorkoutSetCommand {
  // userId?: UserIdVO; // For ownership check, if applicable
  setId: string;
  data: { // This structure should align with OpenAPI's SetUpdate schema, mapped to domain props
    reps?: number | null;
    weight?: number | null;
    notes?: string | null;
    performedAt?: string; // Date as string from API, to be converted
    rpe?: number | null;
    restSec?: number | null;
  };
}

export interface WorkoutSetDto { // Define based on what API should return, likely from WorkoutSet.toPrimitives()
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: string;
  createdAt: string;
  rpe?: number | null;
  restSec?: number | null;
  deviceId?: string | null;
  volume?: number;
}

export interface DeleteWorkoutSetCommand {
  userId: string; // To verify ownership
  setId: string;
}

export class WorkoutService {
  constructor(private readonly workoutSessionRepository: IWorkoutSessionRepository) {}

  async updateWorkoutSet(command: UpdateWorkoutSetCommand): Promise<WorkoutSetDto> {
    const setIdVo = new WorkoutSetIdVO(command.setId);

    const existingSet = await this.workoutSessionRepository.findSetById(setIdVo);
    if (!existingSet) {
      throw new NotFoundError(`WorkoutSet with id ${command.setId} not found.`);
    }

    // Optional: Ownership/Authorization check
    // if (command.userId && !existingSet.sessionId.equals(someSessionFetchedViaUserId.id)) {
    //   throw new AuthorizationError(`User not authorized to update this set.`);
    // }
    
    const updateProps: WorkoutSetUpdateProps = {};
    if (command.data.reps !== undefined) updateProps.reps = command.data.reps;
    if (command.data.weight !== undefined) updateProps.weight = command.data.weight;
    if (command.data.notes !== undefined) updateProps.notes = command.data.notes;
    if (command.data.performedAt !== undefined) {
        updateProps.performedAt = new Date(command.data.performedAt); // Convert string to Date
        if (Number.isNaN(updateProps.performedAt.getTime())) { 
            throw new Error("Invalid date format for performedAt"); 
        }
    }
    if (command.data.rpe !== undefined) updateProps.rpe = command.data.rpe;
    if (command.data.restSec !== undefined) updateProps.restSec = command.data.restSec;


    existingSet.update(updateProps);

    await this.workoutSessionRepository.updateSet(existingSet);

    const updatedSetPrimitives = existingSet.toPrimitives();
    
    const dto: WorkoutSetDto = {
        id: updatedSetPrimitives.id,
        sessionId: updatedSetPrimitives.sessionId,
        exerciseId: updatedSetPrimitives.exerciseId,
        setNumber: updatedSetPrimitives.setNumber,
        reps: updatedSetPrimitives.reps,
        weight: updatedSetPrimitives.weight,
        notes: updatedSetPrimitives.notes,
        performedAt: updatedSetPrimitives.performedAt,
        createdAt: updatedSetPrimitives.createdAt,
        rpe: updatedSetPrimitives.rpe,
        restSec: updatedSetPrimitives.restSec,
        deviceId: updatedSetPrimitives.deviceId,
        volume: updatedSetPrimitives.volume,
    };

    return dto;
  }

  async deleteWorkoutSet(command: DeleteWorkoutSetCommand): Promise<void> {
    const setIdVo = new WorkoutSetIdVO(command.setId);
    const userIdVo = new UserIdVO(command.userId);

    const existingSet = await this.workoutSessionRepository.findSetById(setIdVo);
    if (!existingSet) {
      throw new NotFoundError(`WorkoutSet with id ${command.setId} not found.`);
    }

    // Ownership check
    const session = await this.workoutSessionRepository.findById(existingSet.sessionId);
    if (!session) {
      // This case should ideally not happen if a set exists with this sessionId,
      // but it's a good practice to handle it.
      throw new NotFoundError(
        `WorkoutSession with id ${existingSet.sessionId.value} not found for set ${command.setId}.`
      );
    }

    if (!session.userId.equals(userIdVo)) {
      throw new AuthorizationError(
        `User ${command.userId} is not authorized to delete WorkoutSet ${command.setId}.`
      );
    }

    await this.workoutSessionRepository.deleteSet(setIdVo);
  }
}
