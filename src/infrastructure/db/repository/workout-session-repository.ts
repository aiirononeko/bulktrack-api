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

    const operations = [];

    // 1. Save WorkoutSession (Upsert)
    operations.push(
      this.db
        .insert(this.schema.workoutSessions)
        .values({
          id: sessionPrimitives.id,
          userId: sessionPrimitives.userId,
          menuId: sessionPrimitives.menuId,
          startedAt: sessionPrimitives.startedAt.toISOString(),
          finishedAt: sessionPrimitives.finishedAt
            ? sessionPrimitives.finishedAt.toISOString()
            : null,
        })
        .onConflictDoUpdate({
          target: this.schema.workoutSessions.id,
          set: {
            menuId: sessionPrimitives.menuId,
            userId: sessionPrimitives.userId,
            startedAt: sessionPrimitives.startedAt.toISOString(),
            finishedAt: sessionPrimitives.finishedAt
              ? sessionPrimitives.finishedAt.toISOString()
              : null,
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
      const setValuesToInsert = sessionPrimitives.sets.map(setPrimitive => ({
        id: setPrimitive.id,
        userId: session.userId.value,
        sessionId: session.id.value,
        exerciseId: setPrimitive.exerciseId,
        setNo: setPrimitive.setNumber,
        reps: setPrimitive.reps,
        weight: setPrimitive.weight,
        notes: setPrimitive.notes,
        performed_at: setPrimitive.performedAt, 
        deviceId: "unknown_device", // TODO: Consider how to get actual deviceId. Placeholder for now.
        // rpe, restSec, volume, createdOffline などはスキーマ定義やアプリケーションロジックで処理
      }));
      // workoutSets の onConflictDoUpdate は現状不要なので、単純な insert
      // .returning() をつけなければ、これも batch に含められるはず
      operations.push(this.db.insert(this.schema.workoutSets).values(setValuesToInsert));
    }
    
    if (operations.length > 0) {
      // @ts-expect-error もしくは @ts-ignore: Drizzle/D1のbatch型の厳格さにより、
      // 動的に構築した配列の型と完全に一致させるのが困難なため。
      // operationsの各要素はbatchで許容される型であり、空でないことも確認済み。
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
      .select()
      .from(this.schema.workoutSets)
      .where(eq(this.schema.workoutSets.sessionId, dbSession.id));

    const setRawDataList: WorkoutSetRawData[] = setsResult.map(dbSet => ({
      id: dbSet.id,
      sessionId: dbSet.sessionId,
      exerciseId: dbSet.exerciseId,
      setNumber: dbSet.setNo, // マッピング
      reps: dbSet.reps,
      weight: dbSet.weight,
      notes: dbSet.notes,
      performedAt: dbSet.performed_at,
      // rpe, tempo などエンティティにないものは含めない
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
        .select()
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
}
