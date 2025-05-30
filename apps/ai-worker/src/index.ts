import {
  type AIAnalysisMessage,
  type PatternDetectionMessage,
  isAIAnalysisMessage,
  QueueNames,
} from "@bulktrack/queue-types";
import {
  createCalculators,
  type LoadDistributionCalculator,
} from "@bulktrack/scientific-calc";
import * as schema from "@bulktrack/infrastructure/database/schema";
import { drizzle } from "drizzle-orm/d1";
import { Ai } from "@cloudflare/ai";
import { TrainingPatternAnalyzer } from "@/analyzers/training-pattern";
import { VolumeOptimizationAnalyzer } from "@/analyzers/volume-optimization";
import { ProgressAnalyzer } from "@/analyzers/progress";

interface Env {
  DB: D1Database;
  AI: Ai;
  AI_QUEUE: Queue<AIAnalysisMessage>;
  PATTERN_QUEUE: Queue<PatternDetectionMessage>;
  WEBHOOK_QUEUE?: Queue;
}

export default {
  async queue(
    batch: MessageBatch<AIAnalysisMessage | PatternDetectionMessage>,
    env: Env
  ): Promise<void> {
    console.log(`AI Worker: Processing ${batch.messages.length} messages`);

    const db = drizzle(env.DB);
    const ai = new Ai(env.AI);
    const calculators = createCalculators();

    for (const message of batch.messages) {
      try {
        await processMessage(message.body, env, db, ai, calculators);
        message.ack();
      } catch (error) {
        console.error("Error processing AI analysis:", error);
        message.retry();
      }
    }
  },
};

async function processMessage(
  message: AIAnalysisMessage | PatternDetectionMessage,
  env: Env,
  db: any,
  ai: Ai,
  calculators: ReturnType<typeof createCalculators>
): Promise<void> {
  if (isAIAnalysisMessage(message)) {
    switch (message.type) {
      case "ANALYZE_TRAINING_PATTERN":
        await analyzeTrainingPattern(message, env, db, ai, calculators);
        break;
      case "ANALYZE_VOLUME_TRENDS":
        await analyzeVolumeTrends(message, env, db, ai, calculators);
        break;
      case "GENERATE_RECOMMENDATIONS":
        await generateRecommendations(message, env, db, ai, calculators);
        break;
    }
  } else if (message.type === "PATTERN_DETECTION") {
    await detectPatterns(message as PatternDetectionMessage, env, db, ai, calculators);
  }
}

async function analyzeTrainingPattern(
  message: AIAnalysisMessage,
  env: Env,
  db: any,
  ai: Ai,
  calculators: ReturnType<typeof createCalculators>
): Promise<void> {
  const analyzer = new TrainingPatternAnalyzer(db, ai, calculators);
  const { userId, context } = message;

  console.log(`Analyzing training patterns for user ${userId}`);

  const patterns = await analyzer.analyze(userId, context);

  // Send pattern detection results to pattern queue
  if (patterns.length > 0 && env.PATTERN_QUEUE) {
    await env.PATTERN_QUEUE.send({
      type: "PATTERN_DETECTION",
      userId,
      patterns,
      eventId: crypto.randomUUID(),
      occurredAt: new Date(),
      eventType: "PatternDetected",
      aggregateId: userId,
      aggregateType: "TrainingAnalysis",
    });
  }
}

async function analyzeVolumeTrends(
  message: AIAnalysisMessage,
  env: Env,
  db: any,
  ai: Ai,
  calculators: ReturnType<typeof createCalculators>
): Promise<void> {
  const analyzer = new VolumeOptimizationAnalyzer(db, ai, calculators);
  const { userId, context } = message;

  console.log(`Analyzing volume trends for user ${userId}`);

  const optimization = await analyzer.analyze(userId, context);

  // Send recommendations if significant changes needed
  if (optimization && env.WEBHOOK_QUEUE) {
    await env.WEBHOOK_QUEUE.send({
      type: "SEND_NOTIFICATION",
      userId,
      channel: "in_app",
      content: {
        title: "Training Volume Optimization",
        body: "We've analyzed your training and have recommendations to optimize your volume distribution.",
        data: optimization,
        priority: "medium",
        category: "analysis_complete",
      },
    });
  }
}

async function generateRecommendations(
  message: AIAnalysisMessage,
  env: Env,
  db: any,
  ai: Ai,
  calculators: ReturnType<typeof createCalculators>
): Promise<void> {
  const progressAnalyzer = new ProgressAnalyzer(db, ai, calculators);
  const { userId, context } = message;

  console.log(`Generating recommendations for user ${userId}`);

  const recommendations = await progressAnalyzer.generateRecommendations(
    userId,
    context
  );

  // Store recommendations in database
  // TODO: Implement recommendation storage
}

async function detectPatterns(
  message: PatternDetectionMessage,
  env: Env,
  db: any,
  ai: Ai,
  calculators: ReturnType<typeof createCalculators>
): Promise<void> {
  const { userId, patterns } = message;

  console.log(`Processing ${patterns.length} detected patterns for user ${userId}`);

  // Analyze patterns and trigger appropriate actions
  for (const pattern of patterns) {
    if (pattern.type === "injury_risk" && pattern.confidence > 0.8) {
      // Send high-priority notification
      if (env.WEBHOOK_QUEUE) {
        await env.WEBHOOK_QUEUE.send({
          type: "SEND_NOTIFICATION",
          userId,
          channel: "push",
          content: {
            title: "⚠️ Injury Risk Detected",
            body: pattern.description,
            data: { pattern },
            priority: "high",
            category: "warning",
          },
        });
      }
    }
  }
}