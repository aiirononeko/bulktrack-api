import {
  DailyAggregationService,
  WeeklyAggregationService,
} from "@bulktrack/core";
import * as schema from "@bulktrack/infrastructure/database/schema";
import {
  type VolumeAggregationMessage,
  type BatchVolumeUpdate,
  isVolumeAggregationMessage,
  QueueNames,
} from "@bulktrack/queue-types";
import {
  createCalculators,
  type EffectiveRepsCalculator,
  type VolumeCalculator,
  type OneRepMaxCalculator,
} from "@bulktrack/scientific-calc";
import {
  UserIdVO,
  VolumeThresholdReachedEvent,
} from "@bulktrack/shared-kernel";
import { drizzle } from "drizzle-orm/d1";

interface Env {
  DB: D1Database;
  VOLUME_AGGREGATION_QUEUE: Queue<VolumeAggregationMessage>;
  AI_QUEUE?: Queue;
}

export default {
  async queue(batch: MessageBatch<VolumeAggregationMessage>, env: Env): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages`);

    // Initialize calculators
    const calculators = createCalculators();
    const db = drizzle(env.DB);

    // Process messages in batch for efficiency
    const batchUpdates: BatchVolumeUpdate[] = [];

    for (const message of batch.messages) {
      try {
        const update = await processMessage(message.body, env, calculators);
        if (update) {
          batchUpdates.push(update);
        }
      } catch (error) {
        console.error("Error processing message:", error);
        // Retry the message
        message.retry();
        continue;
      }

      // Acknowledge successful processing
      message.ack();
    }

    // Process batch updates if any
    if (batchUpdates.length > 0) {
      await processBatchUpdates(batchUpdates, env, db);
    }
  },
};

async function processMessage(
  message: VolumeAggregationMessage,
  env: Env,
  calculators: ReturnType<typeof createCalculators>
): Promise<BatchVolumeUpdate | null> {
  if (!isVolumeAggregationMessage(message)) {
    console.warn(`Unknown message type: ${(message as any).type}`);
    return null;
  }

  switch (message.type) {
    case "SET_CREATED":
    case "SET_UPDATED":
      return await handleSetChange(message, env, calculators);
    case "WORKOUT_COMPLETED":
      return await handleWorkoutCompleted(message, env, calculators);
    case "SET_DELETED":
      // Handle set deletion if needed
      return null;
    default:
      console.warn(`Unhandled message type: ${message.type}`);
      return null;
  }
}

async function handleSetChange(
  message: VolumeAggregationMessage,
  env: Env,
  calculators: ReturnType<typeof createCalculators>
): Promise<BatchVolumeUpdate | null> {
  const { userId, exerciseId, volume, setId, timestamp } = message;

  // Calculate effective reps if not provided
  if (message.effectiveReps === null && setId) {
    // TODO: Fetch set details from database to calculate effective reps
    // For now, we'll use basic volume
  }

  const performedDate = new Date(timestamp);
  
  return {
    userId,
    date: performedDate,
    muscleGroup: "", // TODO: Fetch from exercise
    volume: volume,
    effectiveVolume: volume, // TODO: Calculate with effective reps
  };
}

async function handleWorkoutCompleted(
  message: VolumeAggregationMessage,
  env: Env,
  calculators: ReturnType<typeof createCalculators>
): Promise<BatchVolumeUpdate | null> {
  // Handle workout completion aggregation
  return null;
}

async function processBatchUpdates(
  updates: BatchVolumeUpdate[],
  env: Env,
  db: any
): Promise<void> {
  const userIds = [...new Set(updates.map(u => u.userId))];
  
  for (const userId of userIds) {
    const userIdVO = new UserIdVO(userId);
    const userUpdates = updates.filter(u => u.userId === userId);
    
    // Group by date
    const dateGroups = userUpdates.reduce((acc, update) => {
      const dateStr = update.date.toISOString().split("T")[0];
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(update);
      return acc;
    }, {} as Record<string, BatchVolumeUpdate[]>);
    
    // Initialize services with calculators
    const weeklyAggregationService = new WeeklyAggregationService(db, schema);
    const dailyAggregationService = new DailyAggregationService(db, schema);
    
    for (const [dateStr, dayUpdates] of Object.entries(dateGroups)) {
      try {
        // 1. Update daily aggregation
        console.log(`Updating daily aggregation for user ${userId} on ${dateStr}`);
        await dailyAggregationService.updateDailyAggregation(userIdVO, dateStr);
        
        // 2. Update weekly aggregation
        const weekStart = weeklyAggregationService.getWeekStart(new Date(dateStr));
        console.log(
          `Updating weekly aggregation for user ${userId} for week ${weekStart}`,
        );
        await weeklyAggregationService.updateWeeklyAggregation(userIdVO, weekStart);
        
        // 3. Check volume thresholds
        await checkVolumeThresholds(userIdVO, dayUpdates, env);
      } catch (error) {
        console.error(`Failed to aggregate data for user ${userId}:`, error);
        throw error;
      }
    }
  }
}

async function checkVolumeThresholds(
  userId: UserIdVO,
  updates: BatchVolumeUpdate[],
  env: Env
): Promise<void> {
  // TODO: Implement volume threshold checking
  // If threshold is reached, send message to AI queue
  if (env.AI_QUEUE) {
    // await env.AI_QUEUE.send(...);
  }
}
