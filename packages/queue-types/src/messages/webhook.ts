/**
 * Webhook通知用Queueメッセージ
 */

import type { DomainEvent } from '@bulktrack/shared-kernel';

export interface WebhookMessage extends DomainEvent {
  type: 'SEND_WEBHOOK';
  webhookType: WebhookType;
  payload: WebhookPayload;
  retryCount?: number;
  maxRetries?: number;
}

export type WebhookType = 
  | 'workout_completed'
  | 'volume_threshold_reached'
  | 'pattern_detected'
  | 'weekly_report'
  | 'achievement_unlocked';

export interface WebhookPayload {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  body: unknown;
  timeout?: number;
}

export interface NotificationMessage extends DomainEvent {
  type: 'SEND_NOTIFICATION';
  userId: string;
  channel: NotificationChannel;
  content: NotificationContent;
}

export type NotificationChannel = 'email' | 'push' | 'in_app' | 'webhook';

export interface NotificationContent {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high';
  category: NotificationCategory;
}

export type NotificationCategory = 
  | 'training_reminder'
  | 'achievement'
  | 'analysis_complete'
  | 'weekly_summary'
  | 'warning';

export interface BatchNotificationMessage extends DomainEvent {
  type: 'SEND_BATCH_NOTIFICATIONS';
  notifications: Array<{
    userId: string;
    content: NotificationContent;
  }>;
  channel: NotificationChannel;
}