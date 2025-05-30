/**
 * ボリューム集計用Queueメッセージ
 */

import type { DomainEvent } from '@bulktrack/shared-kernel';

export interface VolumeAggregationMessage extends DomainEvent {
  type: 'SET_CREATED' | 'SET_UPDATED' | 'SET_DELETED' | 'WORKOUT_COMPLETED';
  setId?: string;
  workoutId?: string;
  userId: string;
  exerciseId: string;
  volume: number;
  effectiveReps: number | null;
  timestamp: number;
}

export interface BatchVolumeUpdate {
  userId: string;
  date: Date;
  muscleGroup: string;
  volume: number;
  effectiveVolume: number;
}

export interface VolumeThresholdCheck {
  userId: string;
  muscleGroup: string;
  currentVolume: number;
  threshold: number;
  period: 'daily' | 'weekly';
}