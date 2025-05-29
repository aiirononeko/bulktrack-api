/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  aggregateId: string;
  aggregateType: string;
  metadata?: Record<string, unknown>;
}

/**
 * Training set recorded event
 */
export interface TrainingSetRecordedEvent extends DomainEvent {
  eventType: "TrainingSetRecorded";
  aggregateType: "TrainingSet";
  payload: {
    userId: string;
    exerciseId: string;
    setId: string;
    weight: number;
    reps: number;
    rpe?: number;
    volume: number;
    performedAt: Date;
  };
}

/**
 * Volume threshold reached event
 */
export interface VolumeThresholdReachedEvent extends DomainEvent {
  eventType: "VolumeThresholdReached";
  aggregateType: "UserProgress";
  payload: {
    userId: string;
    muscleGroupId: number;
    currentVolume: number;
    threshold: number;
    period: "daily" | "weekly";
  };
}

/**
 * Training pattern detected event
 */
export interface TrainingPatternDetectedEvent extends DomainEvent {
  eventType: "TrainingPatternDetected";
  aggregateType: "TrainingAnalysis";
  payload: {
    userId: string;
    pattern: string;
    confidence: number;
    details: Record<string, unknown>;
  };
}

/**
 * Workout completed event
 */
export interface WorkoutCompletedEvent extends DomainEvent {
  eventType: "WorkoutCompleted";
  aggregateType: "Workout";
  payload: {
    userId: string;
    workoutId: string;
    totalSets: number;
    totalVolume: number;
    duration: number;
    exercises: Array<{
      exerciseId: string;
      sets: number;
      volume: number;
    }>;
  };
}

/**
 * User stats updated event
 */
export interface UserStatsUpdatedEvent extends DomainEvent {
  eventType: "UserStatsUpdated";
  aggregateType: "UserStats";
  payload: {
    userId: string;
    statsType: "daily" | "weekly" | "monthly";
    stats: Record<string, unknown>;
  };
}

/**
 * All domain event types
 */
export type AllDomainEvents =
  | TrainingSetRecordedEvent
  | VolumeThresholdReachedEvent
  | TrainingPatternDetectedEvent
  | WorkoutCompletedEvent
  | UserStatsUpdatedEvent;

/**
 * Event publisher interface
 */
export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
}

/**
 * Event handler interface
 */
export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(event: DomainEvent): boolean;
}

/**
 * Queue configuration
 */
export const QUEUE_CONFIGS = {
  "volume-aggregation": {
    max_batch_size: 100,
    max_batch_timeout: 1,
    handler: "aggregation-worker",
  },
  "ai-analysis": {
    max_batch_size: 10,
    max_batch_timeout: 5,
    handler: "ai-worker",
  },
  "webhook-notifications": {
    max_batch_size: 50,
    max_batch_timeout: 2,
    handler: "webhook-worker",
  },
} as const;

/**
 * Maps event types to their appropriate queues
 */
export const EVENT_QUEUE_MAPPING: Record<string, keyof typeof QUEUE_CONFIGS> = {
  TrainingSetRecorded: "volume-aggregation",
  VolumeThresholdReached: "ai-analysis",
  TrainingPatternDetected: "webhook-notifications",
  WorkoutCompleted: "volume-aggregation",
  UserStatsUpdated: "webhook-notifications",
};
