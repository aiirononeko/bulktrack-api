import type { QueueBindings } from "@bulktrack/infrastructure";
import type { QueueMessage } from "@bulktrack/shared-kernel";

export interface Env {
  // Database
  DB: D1Database;

  // Queues
  VOLUME_AGGREGATION_QUEUE: Queue<QueueMessage>;
  AI_ANALYSIS_QUEUE: Queue<QueueMessage>;
  WEBHOOK_NOTIFICATIONS_QUEUE: Queue<QueueMessage>;

  // KV
  REFRESH_TOKENS_KV: KVNamespace;

  // Environment variables
  JWT_SECRET: string;
  ENVIRONMENT: "development" | "production";
}

export type WorkerEnv = Env & QueueBindings;

export interface Variables {
  userId?: string;
}
