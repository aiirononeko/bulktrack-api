import { eq, desc } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import { WorkoutSession } from "../../../domain/workout/entity";
import type { WorkoutSessionRawData } from "../../../domain/workout/entity";
import type { WorkoutSessionIdVO, UserIdVO } from "../../../domain/shared/vo/identifier";
import type * as fullSchema from "../schema"; // Drizzle schema

export class DrizzleWorkoutSessionRepository implements IWorkoutSessionRepository {
  constructor(
    private readonly db: DrizzleD1Database<typeof fullSchema>,
    private readonly schema: typeof fullSchema,
  ) {}

  async save(session: WorkoutSession): Promise<void> {
    const primitives = session.toPrimitives();
    const valuesToInsertOrUpdate = {
      id: primitives.id,
      userId: primitives.userId,
      menuId: primitives.menuId,
      startedAt: primitives.startedAt.toISOString(),
      finishedAt: primitives.finishedAt ? primitives.finishedAt.toISOString() : null,
    };

    await this.db
      .insert(this.schema.workoutSessions)
      .values(valuesToInsertOrUpdate)
      .onConflictDoUpdate({
        target: this.schema.workoutSessions.id,
        set: {
          userId: valuesToInsertOrUpdate.userId,
          menuId: valuesToInsertOrUpdate.menuId,
          startedAt: valuesToInsertOrUpdate.startedAt,
          finishedAt: valuesToInsertOrUpdate.finishedAt,
        },
      });
  }

  async findById(id: WorkoutSessionIdVO): Promise<WorkoutSession | null> {
    const result = await this.db
      .select()
      .from(this.schema.workoutSessions)
      .where(eq(this.schema.workoutSessions.id, id.value))
      .limit(1);

    if (result.length === 0) {
      return null;
    }
    const dbSession = result[0];
    
    const rawData: WorkoutSessionRawData = {
      id: dbSession.id,
      userId: dbSession.userId,
      menuId: dbSession.menuId,
      startedAt: dbSession.startedAt,
      finishedAt: dbSession.finishedAt,
    };
    return WorkoutSession.fromPersistence(rawData);
  }

  async findByUserId(userId: UserIdVO): Promise<WorkoutSession[]> {
    const dbSessions = await this.db
      .select()
      .from(this.schema.workoutSessions)
      .where(eq(this.schema.workoutSessions.userId, userId.value))
      .orderBy(desc(this.schema.workoutSessions.startedAt));

    return dbSessions.map(dbSession => {
      const rawData: WorkoutSessionRawData = {
        id: dbSession.id,
        userId: dbSession.userId,
        menuId: dbSession.menuId,
        startedAt: dbSession.startedAt,
        finishedAt: dbSession.finishedAt,
      };
      return WorkoutSession.fromPersistence(rawData);
    });
  }
}
