import {
  DailyAggregationService,
  WeeklyAggregationService,
} from "@bulktrack/core";
import * as schema from "@bulktrack/infrastructure/database/schema";
import {
  type DomainEvent,
  type TrainingSetRecordedEvent,
  UserIdVO,
  VolumeThresholdReachedEvent,
} from "@bulktrack/shared-kernel";
import { drizzle } from "drizzle-orm/d1";

interface Env {
  DB: D1Database;
  VOLUME_AGGREGATION_QUEUE: Queue<DomainEvent>;
}

export default {
  async queue(batch: MessageBatch<DomainEvent>, env: Env): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        await processMessage(message.body, env);
      } catch (error) {
        console.error("Error processing message:", error);
        // Retry the message
        message.retry();
        continue;
      }

      // Acknowledge successful processing
      message.ack();
    }
  },
};

async function processMessage(event: DomainEvent, env: Env): Promise<void> {
  switch (event.eventType) {
    case "TrainingSetRecorded":
      await handleTrainingSetRecorded(event as TrainingSetRecordedEvent, env);
      break;
    default:
      console.warn(`Unknown event type: ${event.eventType}`);
  }
}

async function handleTrainingSetRecorded(
  event: TrainingSetRecordedEvent,
  env: Env,
): Promise<void> {
  const { userId, exerciseId, volume, performedAt } = event.payload;

  const db = drizzle(env.DB);
  const userIdVO = new UserIdVO(userId);

  // 日付の情報を取得
  const performedDate = new Date(performedAt);
  const dateStr = performedDate.toISOString().split("T")[0];

  // 週次集計サービスを初期化
  const weeklyAggregationService = new WeeklyAggregationService(db, schema);
  const weekStart = weeklyAggregationService.getWeekStart(performedDate);

  // 日次集計サービスを初期化
  const dailyAggregationService = new DailyAggregationService(db, schema);

  try {
    // 1. 日次集計を更新
    console.log(`Updating daily aggregation for user ${userId} on ${dateStr}`);
    await dailyAggregationService.updateDailyAggregation(userIdVO, dateStr);

    // 2. 週次集計を更新
    console.log(
      `Updating weekly aggregation for user ${userId} for week ${weekStart}`,
    );
    await weeklyAggregationService.updateWeeklyAggregation(userIdVO, weekStart);

    console.log(
      `Successfully aggregated volume for user ${userId}: ${volume}kg`,
    );

    // 3. TODO: ボリューム閾値のチェック
    // 4. TODO: 必要に応じて新しいイベントを発行 (e.g., VolumeThresholdReached)
  } catch (error) {
    console.error(`Failed to aggregate data for user ${userId}:`, error);
    throw error; // Re-throw to trigger retry
  }
}
