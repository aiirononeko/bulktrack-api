import { v7 as uuidv7 } from "uuid";
import type { MenuIdVO, UserIdVO } from "../shared/vo/identifier";
import { WorkoutSessionIdVO } from "../shared/vo/identifier";
import { WorkoutSession } from "./entities/workout-session.entity";
import type { IWorkoutSessionRepository } from "./workout-set-repository";

function generateNewWorkoutSessionId(): WorkoutSessionIdVO {
  return new WorkoutSessionIdVO(uuidv7());
}

export class WorkoutSessionService {
  constructor(
    private readonly workoutSessionRepository: IWorkoutSessionRepository,
  ) {}

  public startSession(params: {
    userId: UserIdVO;
    menuId?: MenuIdVO | null;
    customSessionIdGenerator?: () => WorkoutSessionIdVO;
    customDateProvider?: () => Date;
  }): WorkoutSession {
    const now = params.customDateProvider
      ? params.customDateProvider()
      : new Date();
    const sessionId = params.customSessionIdGenerator
      ? params.customSessionIdGenerator()
      : generateNewWorkoutSessionId();

    const session = WorkoutSession.create({
      id: sessionId,
      userId: params.userId,
      menuId: params.menuId,
      startedAt: now,
    });

    return session;
  }

  public async finishSession(params: {
    sessionId: WorkoutSessionIdVO;
    userId: UserIdVO;
    customDateProvider?: () => Date;
  }): Promise<WorkoutSession> {
    const session = await this.workoutSessionRepository.findById(
      params.sessionId,
    );

    if (!session) {
      throw new Error("Workout session not found.");
    }

    if (!session.userId.equals(params.userId)) {
      throw new Error("Forbidden to finish this workout session.");
    }

    const now = params.customDateProvider
      ? params.customDateProvider()
      : new Date();
    session.finish(now);

    return session;
  }
}
