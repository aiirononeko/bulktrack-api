import { eq, desc, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import { WorkoutSession } from "../../../domain/workout/entities/workout-session.entity";
import type { WorkoutSessionRawData } from "../../../domain/workout/entities/workout-session.entity";
import { WorkoutSet } from "../../../domain/workout/entities/workout-set.entity";
import type { WorkoutSetRawData } from "../../../domain/workout/entities/workout-set.entity";
import type { WorkoutSessionIdVO, UserIdVO } from "../../../domain/shared/vo/identifier";
import type * as fullSchema from "../schema"; // Drizzle schema

export class DrizzleWorkoutSessionRepository implements IWorkoutSessionRepository {
  constructor(
    private readonly db: DrizzleD1Database<typeof fullSchema>,
    private readonly schema: typeof fullSchema,
  ) {}

  async save(session: WorkoutSession): Promise<void> {
    const sessionPrimitives = session.toPrimitives();

    const operations: unknown[] = [];

    // 1. Save WorkoutSession (Upsert)
    const sessionDataForInsert: typeof this.schema.workoutSessions.$inferInsert = {
      id: sessionPrimitives.id,
      userId: sessionPrimitives.userId,
      menuId: sessionPrimitives.menuId || undefined,
      startedAt: sessionPrimitives.startedAt,
      finishedAt: sessionPrimitives.finishedAt || undefined,
    };
    operations.push(
      this.db
        .insert(this.schema.workoutSessions)
        .values(sessionDataForInsert)
        .onConflictDoUpdate({
          target: this.schema.workoutSessions.id,
          set: {
            menuId: sessionPrimitives.menuId || undefined,
            startedAt: sessionPrimitives.startedAt,
            finishedAt: sessionPrimitives.finishedAt || undefined,
          },
        }),
    );

    // 2. Delete existing WorkoutSets for this session
    operations.push(
      this.db
        .delete(this.schema.workoutSets)
        .where(eq(this.schema.workoutSets.sessionId, session.id.value)),
    );

    // 3. Insert new WorkoutSets if any
    if (sessionPrimitives.sets && sessionPrimitives.sets.length > 0) {
      for (const setPrimitive of sessionPrimitives.sets) {
        const setToInsert: typeof this.schema.workoutSets.$inferInsert = {
            id: setPrimitive.id,
            userId: session.userId.value, 
            sessionId: session.id.value, 
            exerciseId: setPrimitive.exerciseId,
            setNo: setPrimitive.setNumber,
            performed_at: setPrimitive.performedAt,
            deviceId: setPrimitive.deviceId || "unknown_device",
            reps: setPrimitive.reps ?? undefined,
            weight: setPrimitive.weight ?? undefined,
            notes: setPrimitive.notes ?? undefined,
            rpe: setPrimitive.rpe ?? undefined,
            restSec: setPrimitive.restSec ?? undefined,
        };
        operations.push(
          this.db.insert(this.schema.workoutSets).values(setToInsert)
        );
      }
    }
    
    if (operations.length > 0) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.db.batch(operations);
    }
  }

  async findById(id: WorkoutSessionIdVO): Promise<WorkoutSession | null> {
    const sessionResult = await this.db
      .select()
      .from(this.schema.workoutSessions)
      .where(eq(this.schema.workoutSessions.id, id.value))
      .limit(1);

    if (sessionResult.length === 0) {
      return null;
    }
    const dbSession = sessionResult[0];

    // Fetch related sets
    const setsResult = await this.db
      .select({
        id: this.schema.workoutSets.id,
        sessionId: this.schema.workoutSets.sessionId,
        exerciseId: this.schema.workoutSets.exerciseId,
        setNo: this.schema.workoutSets.setNo,
        reps: this.schema.workoutSets.reps,
        weight: this.schema.workoutSets.weight,
        notes: this.schema.workoutSets.notes,
        performed_at: this.schema.workoutSets.performed_at,
        created_at: this.schema.workoutSets.createdAt, // Select createdAt
        rpe: this.schema.workoutSets.rpe,
        restSec: this.schema.workoutSets.restSec,
        deviceId: this.schema.workoutSets.deviceId,
        // volume is generated, not selected directly if not needed for WorkoutSetRawData
      })
      .from(this.schema.workoutSets)
      .where(eq(this.schema.workoutSets.sessionId, dbSession.id));

    const setRawDataList: WorkoutSetRawData[] = setsResult.map(dbSet => ({
      id: dbSet.id,
      sessionId: dbSet.sessionId,
      exerciseId: dbSet.exerciseId,
      setNumber: dbSet.setNo,
      reps: dbSet.reps,
      weight: dbSet.weight,
      notes: dbSet.notes,
      performedAt: dbSet.performed_at, // Map from db column name
      createdAt: dbSet.created_at,   // Map from db column name
      rpe: dbSet.rpe,
      restSec: dbSet.restSec,
      deviceId: dbSet.deviceId,
      // volume can be calculated by entity or if WorkoutSetRawData requires it, select and map
    }));

    const sessionRawData: WorkoutSessionRawData = {
      id: dbSession.id,
      userId: dbSession.userId,
      menuId: dbSession.menuId,
      startedAt: dbSession.startedAt,
      finishedAt: dbSession.finishedAt,
      sets: setRawDataList,
    };
    return WorkoutSession.fromPersistence(sessionRawData);
  }

  async findByUserId(userId: UserIdVO): Promise<WorkoutSession[]> {
    const dbSessions = await this.db
      .select()
      .from(this.schema.workoutSessions)
      .where(eq(this.schema.workoutSessions.userId, userId.value))
      .orderBy(desc(this.schema.workoutSessions.startedAt));

    if (dbSessions.length === 0) {
      return [];
    }

    const sessionsWithSets: WorkoutSession[] = [];
    for (const dbSession of dbSessions) {
      const setsResult = await this.db
        .select({
            id: this.schema.workoutSets.id,
            sessionId: this.schema.workoutSets.sessionId,
            exerciseId: this.schema.workoutSets.exerciseId,
            setNo: this.schema.workoutSets.setNo,
            reps: this.schema.workoutSets.reps,
            weight: this.schema.workoutSets.weight,
            notes: this.schema.workoutSets.notes,
            performed_at: this.schema.workoutSets.performed_at,
            created_at: this.schema.workoutSets.createdAt, // Select createdAt
            rpe: this.schema.workoutSets.rpe,
            restSec: this.schema.workoutSets.restSec,
            deviceId: this.schema.workoutSets.deviceId,
        })
        .from(this.schema.workoutSets)
        .where(eq(this.schema.workoutSets.sessionId, dbSession.id));
      
      const setRawDataList: WorkoutSetRawData[] = setsResult.map(dbSet => ({
        id: dbSet.id,
        sessionId: dbSet.sessionId,
        exerciseId: dbSet.exerciseId,
        setNumber: dbSet.setNo,
        reps: dbSet.reps,
        weight: dbSet.weight,
        notes: dbSet.notes,
        performedAt: dbSet.performed_at,
        createdAt: dbSet.created_at,
        rpe: dbSet.rpe,
        restSec: dbSet.restSec,
        deviceId: dbSet.deviceId,
      }));
      
      const sessionRawData: WorkoutSessionRawData = {
        id: dbSession.id,
        userId: dbSession.userId,
        menuId: dbSession.menuId,
        startedAt: dbSession.startedAt,
        finishedAt: dbSession.finishedAt,
        sets: setRawDataList,
      };
      sessionsWithSets.push(WorkoutSession.fromPersistence(sessionRawData));
    }
    return sessionsWithSets;
  }

  async getSetsBySessionId(sessionId: WorkoutSessionIdVO): Promise<WorkoutSet[]> {
    const setsResult = await this.db
      .select({
        id: this.schema.workoutSets.id,
        sessionId: this.schema.workoutSets.sessionId,
        exerciseId: this.schema.workoutSets.exerciseId,
        setNo: this.schema.workoutSets.setNo,
        reps: this.schema.workoutSets.reps,
        weight: this.schema.workoutSets.weight,
        notes: this.schema.workoutSets.notes,
        performed_at: this.schema.workoutSets.performed_at, // DB column name
        created_at: this.schema.workoutSets.createdAt,     // DB column name
        rpe: this.schema.workoutSets.rpe,
        restSec: this.schema.workoutSets.restSec,
        deviceId: this.schema.workoutSets.deviceId,
        // userId is part of WorkoutSession, not WorkoutSet directly in DB.
        // WorkoutSet.fromPersistence reconstructs WorkoutSet which does not require userId in its constructor.
      })
      .from(this.schema.workoutSets)
      .where(eq(this.schema.workoutSets.sessionId, sessionId.value))
      .orderBy(this.schema.workoutSets.setNo); // Optional: order by set number

    if (setsResult.length === 0) {
      return [];
    }

    return setsResult.map(dbSet => {
      const rawData: WorkoutSetRawData = {
        id: dbSet.id,
        sessionId: dbSet.sessionId, 
        exerciseId: dbSet.exerciseId,
        setNumber: dbSet.setNo,
        reps: dbSet.reps,
        weight: dbSet.weight,
        notes: dbSet.notes,
        performedAt: dbSet.performed_at,
        createdAt: dbSet.created_at,
        rpe: dbSet.rpe,
        restSec: dbSet.restSec,
        deviceId: dbSet.deviceId,
        // volume is calculated by the entity itself if needed, not directly stored/fetched for raw data mapping here
      };
      return WorkoutSet.fromPersistence(rawData);
    });
  }
}
