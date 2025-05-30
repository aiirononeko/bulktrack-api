import type { NotificationContent } from "@bulktrack/queue-types";

interface PushEnv {
  // Push notification service configuration
  PUSH_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

export class PushHandler {
  constructor(private env: PushEnv) {}

  async send(userId: string, content: NotificationContent): Promise<void> {
    // Get user's push subscription
    const subscriptions = await this.getUserPushSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    // Build push notification payload
    const payload = this.buildPushPayload(content);
    
    // Send to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(sub => this.sendPushNotification(sub, payload))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(
      `Push notifications for user ${userId}: ${successful} sent, ${failed} failed`
    );

    // Clean up invalid subscriptions
    if (failed > 0) {
      await this.cleanupInvalidSubscriptions(userId, results, subscriptions);
    }
  }

  private async getUserPushSubscriptions(userId: string): Promise<any[]> {
    // TODO: Fetch push subscriptions from database
    // This would typically return an array of web push subscription objects
    return [];
  }

  private buildPushPayload(content: NotificationContent): any {
    const iconMap = {
      training_reminder: '💪',
      achievement: '🎉',
      weekly_summary: '📊',
      analysis_complete: '📈',
      warning: '⚠️',
    };

    const icon = iconMap[content.category] || '🔔';
    
    return {
      title: `${icon} ${content.title}`,
      body: content.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: content.category,
      requireInteraction: content.priority === 'high',
      data: {
        category: content.category,
        priority: content.priority,
        ...content.data,
      },
      actions: this.getNotificationActions(content.category),
    };
  }

  private getNotificationActions(category: string): any[] {
    const actionsMap: Record<string, { action: string; title: string }[]> = {
      training_reminder: [
        { action: 'start', title: 'Start Workout' },
        { action: 'snooze', title: 'Snooze 30min' },
      ],
      achievement: [
        { action: 'view', title: 'View Achievement' },
        { action: 'share', title: 'Share' },
      ],
      weekly_summary: [
        { action: 'view', title: 'View Summary' },
      ],
      analysis_complete: [
        { action: 'view', title: 'View Analysis' },
      ],
      warning: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    return actionsMap[category] || [];
  }

  private async sendPushNotification(
    subscription: any,
    payload: any
  ): Promise<void> {
    // TODO: Implement actual web push sending
    // This would use the Web Push Protocol with VAPID
    console.log('Would send push notification:', {
      endpoint: subscription.endpoint,
      payload,
    });
    
    // Placeholder - throw error for expired subscriptions
    if (subscription.expirationTime && subscription.expirationTime < Date.now()) {
      throw new Error('Subscription expired');
    }
  }

  private async cleanupInvalidSubscriptions(
    userId: string,
    results: PromiseSettledResult<void>[],
    subscriptions: any[]
  ): Promise<void> {
    const invalidIndices: number[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const error = result.reason;
        // Check for permanent failures
        if (
          error.message.includes('expired') ||
          error.message.includes('invalid') ||
          error.statusCode === 410 // Gone
        ) {
          invalidIndices.push(index);
        }
      }
    });

    if (invalidIndices.length > 0) {
      // TODO: Remove invalid subscriptions from database
      console.log(
        `Removing ${invalidIndices.length} invalid push subscriptions for user ${userId}`
      );
    }
  }
}