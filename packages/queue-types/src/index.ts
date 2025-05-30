/**
 * @bulktrack/queue-types
 * Cloudflare Queue用のメッセージ型定義
 */

// Import types for internal use
import type {
  VolumeAggregationMessage,
  BatchVolumeUpdate,
  VolumeThresholdCheck,
} from '@/messages/volume-aggregation';

import type {
  AIAnalysisMessage,
  AIAnalysisContext,
  PatternDetectionMessage,
  TrainingPattern,
  VolumeOptimizationMessage,
  AdjustmentPlan,
} from '@/messages/ai-analysis';

import type {
  WebhookMessage,
  WebhookType,
  WebhookPayload,
  NotificationMessage,
  NotificationChannel,
  NotificationContent,
  NotificationCategory,
  BatchNotificationMessage,
} from '@/messages/webhook';

// Re-export types
export type {
  VolumeAggregationMessage,
  BatchVolumeUpdate,
  VolumeThresholdCheck,
} from '@/messages/volume-aggregation';

export type {
  AIAnalysisMessage,
  AIAnalysisContext,
  PatternDetectionMessage,
  TrainingPattern,
  VolumeOptimizationMessage,
  AdjustmentPlan,
} from '@/messages/ai-analysis';

export type {
  WebhookMessage,
  WebhookType,
  WebhookPayload,
  NotificationMessage,
  NotificationChannel,
  NotificationContent,
  NotificationCategory,
  BatchNotificationMessage,
} from '@/messages/webhook';

// Queue Configurations
export {
  QueueNames,
  QUEUE_CONFIGS,
  QUEUE_BINDINGS,
} from '@/configs';

export type {
  QueueConfig,
} from '@/configs';

// Union types for message routing
export type QueueMessage = 
  | VolumeAggregationMessage
  | AIAnalysisMessage
  | PatternDetectionMessage
  | VolumeOptimizationMessage
  | WebhookMessage
  | NotificationMessage
  | BatchNotificationMessage;

// Type guards
export const isVolumeAggregationMessage = (
  msg: QueueMessage
): msg is VolumeAggregationMessage => {
  return msg.type === 'SET_CREATED' || 
         msg.type === 'SET_UPDATED' || 
         msg.type === 'SET_DELETED' || 
         msg.type === 'WORKOUT_COMPLETED';
};

export const isAIAnalysisMessage = (
  msg: QueueMessage
): msg is AIAnalysisMessage => {
  return msg.type === 'ANALYZE_TRAINING_PATTERN' || 
         msg.type === 'ANALYZE_VOLUME_TRENDS' || 
         msg.type === 'GENERATE_RECOMMENDATIONS';
};

export const isWebhookMessage = (
  msg: QueueMessage
): msg is WebhookMessage => {
  return msg.type === 'SEND_WEBHOOK';
};

export const isNotificationMessage = (
  msg: QueueMessage
): msg is NotificationMessage => {
  return msg.type === 'SEND_NOTIFICATION';
};