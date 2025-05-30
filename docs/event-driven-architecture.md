# Event-Driven Architecture

## Overview

The Bulktrack API uses an event-driven architecture to enable loose coupling between workers and facilitate asynchronous processing. This architecture is built on top of Cloudflare Queues.

## Architecture Components

### 1. Event Publishers
Each worker has its own event publisher that transforms domain events into queue messages:

- **AggregationEventPublisher**: Publishes events from aggregation processing
- **AIEventPublisher**: Publishes events from AI analysis
- **WebhookEventPublisher**: Publishes events from webhook/notification delivery

### 2. Event Handlers
Event handlers process incoming domain events and execute the appropriate business logic:

#### Aggregation Worker Handlers
- **WorkoutCompletedEventHandler**: Processes workout completion events
- **VolumeUpdatedEventHandler**: Processes volume update events

#### AI Worker Handlers
- **AggregationUpdatedEventHandler**: Processes aggregation update events
- **ThresholdExceededEventHandler**: Processes threshold exceeded events

#### Webhook Worker Handlers
- **NotificationEventHandler**: Processes notification request events
- **PatternDetectedEventHandler**: Processes pattern detection events

### 3. Event Bus Configuration
The shared event bus configuration (`event-bus-config.ts`) provides:
- Event routing rules
- Queue mappings
- Retry policies
- Batch processing support

## Event Flow

### Example: Workout Completion Flow

1. **API Worker** receives workout completion request
2. Publishes `WorkoutCompleted` event to volume aggregation queue
3. **Aggregation Worker** processes the event:
   - Updates daily/weekly aggregations
   - Checks volume thresholds
   - If thresholds exceeded, publishes `VolumeThresholdReached` event
4. **AI Worker** receives threshold event:
   - Analyzes training patterns
   - Generates recommendations
   - Publishes `TrainingPatternDetected` event
5. **Webhook Worker** receives pattern event:
   - Sends in-app notification
   - Optionally sends email for high-confidence patterns

## Queue Configuration

### Volume Aggregation Queue
- Handles: Training set events, workout completion
- Batch size: 100
- Timeout: 1 second

### AI Analysis Queue
- Handles: Threshold events, aggregation updates
- Batch size: 10
- Timeout: 5 seconds

### Webhook Notification Queue
- Handles: Notification requests, pattern detections
- Batch size: 50
- Timeout: 2 seconds

## Error Handling

### Retry Policy
- Max retries: 3
- Backoff multiplier: 2
- Initial delay: 1 second

### Dead Letter Queue
Failed messages are sent to a dead letter queue after max retries for investigation.

## Adding New Events

To add a new event type:

1. Define the event interface in `shared-kernel/src/types/events.ts`
2. Add routing configuration in `event-bus-config.ts`
3. Create handler(s) in the appropriate worker
4. Update the worker's index.ts to register the handler
5. Publish the event from the appropriate use case

## Best Practices

1. **Event Naming**: Use past tense (e.g., `WorkoutCompleted`, not `CompleteWorkout`)
2. **Event Payload**: Include all necessary data to process the event independently
3. **Idempotency**: Handlers should be idempotent to handle duplicate messages
4. **Error Handling**: Always acknowledge messages after processing or retry
5. **Monitoring**: Log all event processing for debugging and monitoring
