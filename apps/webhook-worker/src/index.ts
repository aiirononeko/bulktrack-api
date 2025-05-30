import {
  type WebhookMessage,
  type NotificationMessage,
  type BatchNotificationMessage,
  isWebhookMessage,
  isNotificationMessage,
} from "@bulktrack/queue-types";
import * as schema from "@bulktrack/infrastructure/database/schema";
import { drizzle } from "drizzle-orm/d1";
import { WebhookService } from "@/services/webhook";
import { NotificationService } from "@/services/notification";
import { EmailHandler } from "@/handlers/email";
import { PushHandler } from "@/handlers/push";
import { InAppHandler } from "@/handlers/in-app";

interface Env {
  DB: D1Database;
  WEBHOOK_CACHE: KVNamespace;
  DEAD_LETTER_QUEUE: Queue;
  WEBHOOK_QUEUE: Queue<WebhookMessage | NotificationMessage>;
  WEBHOOK_TIMEOUT: string;
  MAX_WEBHOOK_SIZE: string;
  // Email service configuration
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_DOMAIN?: string;
  // Push notification service configuration
  PUSH_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

export default {
  async queue(
    batch: MessageBatch<WebhookMessage | NotificationMessage | BatchNotificationMessage>,
    env: Env
  ): Promise<void> {
    console.log(`Webhook Worker: Processing ${batch.messages.length} messages`);

    const db = drizzle(env.DB);
    const webhookService = new WebhookService(env);
    const notificationService = new NotificationService(db, {
      email: new EmailHandler(env),
      push: new PushHandler(env),
      in_app: new InAppHandler(db),
      webhook: webhookService,
    });

    // Process messages in parallel for better performance
    const promises = batch.messages.map(async (message) => {
      try {
        await processMessage(message.body, webhookService, notificationService, env);
        message.ack();
      } catch (error) {
        console.error("Error processing webhook/notification:", error);
        
        // Check if should retry or send to DLQ
        const retryCount = (message.body as any).retryCount || 0;
        if (retryCount < 3) {
          message.retry();
        } else {
          // Send to dead letter queue
          await env.DEAD_LETTER_QUEUE.send({
            originalMessage: message.body,
            error: error instanceof Error ? error.message : String(error),
            failedAt: new Date().toISOString(),
          });
          message.ack(); // Acknowledge to prevent infinite retries
        }
      }
    });

    await Promise.allSettled(promises);
  },
};

async function processMessage(
  message: WebhookMessage | NotificationMessage | BatchNotificationMessage,
  webhookService: WebhookService,
  notificationService: NotificationService,
  env: Env
): Promise<void> {
  if (isWebhookMessage(message)) {
    await webhookService.sendWebhook(message);
  } else if (isNotificationMessage(message)) {
    await notificationService.sendNotification(message);
  } else if (message.type === "SEND_BATCH_NOTIFICATIONS") {
    await notificationService.sendBatchNotifications(message as BatchNotificationMessage);
  } else {
    console.warn(`Unknown message type: ${(message as any).type}`);
  }
}