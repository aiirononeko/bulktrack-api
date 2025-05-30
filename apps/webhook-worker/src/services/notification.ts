import type {
  NotificationMessage,
  BatchNotificationMessage,
  NotificationChannel,
} from "@bulktrack/queue-types";
import type { EmailHandler } from "@/handlers/email";
import type { PushHandler } from "@/handlers/push";
import type { InAppHandler } from "@/handlers/in-app";
import type { WebhookService } from "@/services/webhook";

interface NotificationHandlers {
  email: EmailHandler;
  push: PushHandler;
  in_app: InAppHandler;
  webhook: WebhookService;
}

export class NotificationService {
  constructor(
    private db: any,
    private handlers: NotificationHandlers
  ) {}

  async sendNotification(message: NotificationMessage): Promise<void> {
    const { userId, channel, content } = message;
    
    console.log(`Sending ${content.category} notification to user ${userId} via ${channel}`);

    // Get user preferences
    const preferences = await this.getUserNotificationPreferences(userId);
    
    // Check if user has opted out of this notification type
    if (!this.shouldSendNotification(preferences, channel, content.category)) {
      console.log(`User ${userId} has opted out of ${content.category} notifications via ${channel}`);
      return;
    }

    // Send notification through appropriate channel
    switch (channel) {
      case 'email':
        await this.handlers.email.send(userId, content);
        break;
      case 'push':
        await this.handlers.push.send(userId, content);
        break;
      case 'in_app':
        await this.handlers.in_app.send(userId, content);
        break;
      case 'webhook':
        const webhookUrl = await this.getUserWebhookUrl(userId);
        if (webhookUrl) {
          await this.handlers.webhook.sendWebhook({
            type: 'SEND_WEBHOOK',
            webhookType: 'achievement_unlocked',
            payload: {
              url: webhookUrl,
              method: 'POST' as const,
              body: {
                userId,
                notification: content,
              },
            },
            eventId: crypto.randomUUID(),
            occurredAt: new Date(),
            eventType: 'WebhookNotification',
            aggregateId: userId,
            aggregateType: 'Notification',
          });
        }
        break;
      default:
        console.warn(`Unknown notification channel: ${channel}`);
    }

    // Record notification sent
    await this.recordNotification(userId, channel, content);
  }

  async sendBatchNotifications(
    message: BatchNotificationMessage
  ): Promise<void> {
    const { notifications, channel } = message;
    
    console.log(`Sending batch of ${notifications.length} notifications via ${channel}`);

    // Group notifications by similar content for efficiency
    const grouped = this.groupNotifications(notifications);
    
    // Send notifications in parallel with rate limiting
    const batchSize = 10;
    for (let i = 0; i < grouped.length; i += batchSize) {
      const batch = grouped.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(notification =>
          this.sendNotification({
            ...message,
            type: 'SEND_NOTIFICATION',
            userId: notification.userId,
            content: notification.content,
          })
        )
      );
      
      // Add delay between batches to prevent overwhelming services
      if (i + batchSize < grouped.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async getUserNotificationPreferences(
    userId: string
  ): Promise<any> {
    // TODO: Implement database query for user preferences
    return {
      email: {
        training_reminder: true,
        achievement: true,
        weekly_summary: true,
        analysis_complete: false,
        warning: true,
      },
      push: {
        training_reminder: true,
        achievement: true,
        weekly_summary: false,
        analysis_complete: true,
        warning: true,
      },
      in_app: {
        all: true,
      },
    };
  }

  private shouldSendNotification(
    preferences: any,
    channel: NotificationChannel,
    category: string
  ): boolean {
    if (!preferences[channel]) return false;
    
    if (channel === 'in_app' && preferences.in_app.all) return true;
    
    return preferences[channel][category] !== false;
  }

  private async getUserWebhookUrl(userId: string): Promise<string | null> {
    // TODO: Implement database query for user webhook configuration
    return null;
  }

  private async recordNotification(
    userId: string,
    channel: NotificationChannel,
    content: any
  ): Promise<void> {
    // TODO: Record notification in database for analytics and history
    console.log(`Recording notification for user ${userId}`);
  }

  private groupNotifications(
    notifications: Array<{ userId: string; content: any }>
  ): Array<{ userId: string; content: any }> {
    // Group by content similarity to potentially batch similar notifications
    // For now, return as-is
    return notifications;
  }
}