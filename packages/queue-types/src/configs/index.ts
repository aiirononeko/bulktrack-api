/**
 * Queue設定と定数
 */

export enum QueueNames {
  // 高優先度・低レイテンシ
  VOLUME_AGGREGATION = 'volume-aggregation',      // セット登録時の集計
  REALTIME_ANALYTICS = 'realtime-analytics',      // リアルタイム分析
  
  // 中優先度
  AI_ANALYSIS = 'ai-analysis',                    // AI分析タスク
  PATTERN_DETECTION = 'pattern-detection',        // パターン検出
  
  // 低優先度・バッチ処理
  RESEARCH_SYNC = 'research-sync',                // 論文データ同期
  EXPORT_GENERATION = 'export-generation',        // レポート生成
  WEBHOOK_NOTIFICATIONS = 'webhook-notifications', // 外部通知
}

export interface QueueConfig {
  max_batch_size: number;
  max_batch_timeout: number; // seconds
  max_retries: number;
  visibility_timeout: number; // seconds
  dead_letter_queue?: string;
}

export const QUEUE_CONFIGS: Record<QueueNames, QueueConfig> = {
  [QueueNames.VOLUME_AGGREGATION]: {
    max_batch_size: 100,
    max_batch_timeout: 1,  // 1秒でバッチ処理
    max_retries: 3,
    visibility_timeout: 30,
  },
  [QueueNames.REALTIME_ANALYTICS]: {
    max_batch_size: 50,
    max_batch_timeout: 0.5,  // 500msでバッチ処理
    max_retries: 2,
    visibility_timeout: 15,
  },
  [QueueNames.AI_ANALYSIS]: {
    max_batch_size: 10,   // AI処理は重いので少なめ
    max_batch_timeout: 5,
    max_retries: 2,
    visibility_timeout: 300,  // 5分のタイムアウト
  },
  [QueueNames.PATTERN_DETECTION]: {
    max_batch_size: 20,
    max_batch_timeout: 10,
    max_retries: 3,
    visibility_timeout: 120,
  },
  [QueueNames.RESEARCH_SYNC]: {
    max_batch_size: 1,    // シーケンシャル処理
    max_batch_timeout: 60,
    max_retries: 5,
    visibility_timeout: 600,
  },
  [QueueNames.EXPORT_GENERATION]: {
    max_batch_size: 5,
    max_batch_timeout: 30,
    max_retries: 3,
    visibility_timeout: 300,
  },
  [QueueNames.WEBHOOK_NOTIFICATIONS]: {
    max_batch_size: 50,
    max_batch_timeout: 2,
    max_retries: 3,
    visibility_timeout: 60,
    dead_letter_queue: 'webhook-dlq',
  },
};

// Queueバインディングの環境変数名
export const QUEUE_BINDINGS = {
  [QueueNames.VOLUME_AGGREGATION]: 'VOLUME_QUEUE',
  [QueueNames.REALTIME_ANALYTICS]: 'ANALYTICS_QUEUE',
  [QueueNames.AI_ANALYSIS]: 'AI_QUEUE',
  [QueueNames.PATTERN_DETECTION]: 'PATTERN_QUEUE',
  [QueueNames.RESEARCH_SYNC]: 'RESEARCH_QUEUE',
  [QueueNames.EXPORT_GENERATION]: 'EXPORT_QUEUE',
  [QueueNames.WEBHOOK_NOTIFICATIONS]: 'WEBHOOK_QUEUE',
} as const;