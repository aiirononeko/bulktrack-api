import {
  type DomainEvent,
  type DomainEventPublisher,
  EVENT_QUEUE_MAPPING,
  QUEUE_CONFIGS,
} from "@bulktrack/shared-kernel";

// Type for Cloudflare Worker Queue
type CloudflareQueue = {
  send(message: DomainEvent): Promise<void>;
  sendBatch(messages: DomainEvent[]): Promise<void>;
};

export interface QueueBindings {
  VOLUME_AGGREGATION_QUEUE: CloudflareQueue;
  AI_ANALYSIS_QUEUE: CloudflareQueue;
  WEBHOOK_NOTIFICATIONS_QUEUE: CloudflareQueue;
}

export class CloudflareQueueEventPublisher implements DomainEventPublisher {
  constructor(private readonly queues: QueueBindings) {}

  async publish(event: DomainEvent): Promise<void> {
    const queueName = EVENT_QUEUE_MAPPING[event.eventType];
    if (!queueName) {
      console.warn(`No queue mapping found for event type: ${event.eventType}`);
      return;
    }

    const queue = this.getQueue(queueName);
    if (!queue) {
      // In development, queues might not be configured
      console.warn(`Queue not found: ${queueName}. Event not published.`);
      return;
    }

    try {
      await queue.send(event);
    } catch (error) {
      console.error(`Failed to publish event to queue ${queueName}:`, error);
      // Don't throw - allow the main operation to succeed even if queue publishing fails
    }
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    // Group events by queue
    const eventsByQueue = new Map<keyof typeof QUEUE_CONFIGS, DomainEvent[]>();

    for (const event of events) {
      const queueName = EVENT_QUEUE_MAPPING[event.eventType];
      if (!queueName) {
        console.warn(
          `No queue mapping found for event type: ${event.eventType}`,
        );
        continue;
      }

      if (!eventsByQueue.has(queueName)) {
        eventsByQueue.set(queueName, []);
      }
      eventsByQueue.get(queueName)?.push(event);
    }

    // Send batches to respective queues
    const promises: Promise<void>[] = [];
    for (const [queueName, queueEvents] of eventsByQueue) {
      const queue = this.getQueue(queueName);
      if (!queue) {
        console.error(`Queue not found: ${queueName}`);
        continue;
      }

      // Send events in batches respecting max batch size
      const config = QUEUE_CONFIGS[queueName];
      const maxBatchSize = config.max_batch_size;

      for (let i = 0; i < queueEvents.length; i += maxBatchSize) {
        const batch = queueEvents.slice(i, i + maxBatchSize);
        promises.push(queue.sendBatch(batch));
      }
    }

    await Promise.all(promises);
  }

  private getQueue(
    queueName: keyof typeof QUEUE_CONFIGS,
  ): CloudflareQueue | null {
    switch (queueName) {
      case "volume-aggregation":
        return this.queues.VOLUME_AGGREGATION_QUEUE;
      case "ai-analysis":
        return this.queues.AI_ANALYSIS_QUEUE;
      case "webhook-notifications":
        return this.queues.WEBHOOK_NOTIFICATIONS_QUEUE;
      default:
        return null;
    }
  }
}
