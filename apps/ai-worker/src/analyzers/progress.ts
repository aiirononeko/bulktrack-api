import type { Ai } from "@cloudflare/ai";
import type { AIAnalysisContext } from "@bulktrack/queue-types";
import type {
  OneRepMaxCalculator,
  VolumeCalculator,
} from "@bulktrack/scientific-calc";

interface ProgressMetrics {
  strengthGains: Record<string, number>; // Percentage increase in 1RM
  volumeProgression: Record<string, number>; // Volume increase over time
  consistencyScore: number; // 0-1 score for training consistency
  recoveryScore: number; // 0-1 score for recovery quality
}

interface Recommendation {
  category: 'training' | 'nutrition' | 'recovery' | 'technique';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actionItems: string[];
}

export class ProgressAnalyzer {
  constructor(
    private db: any,
    private ai: Ai,
    private calculators: ReturnType<typeof import("@bulktrack/scientific-calc").createCalculators>
  ) {}

  async generateRecommendations(
    userId: string,
    context: AIAnalysisContext
  ): Promise<Recommendation[]> {
    // Gather comprehensive progress metrics
    const metrics = await this.calculateProgressMetrics(userId, context);
    
    // Generate recommendations based on metrics
    const recommendations: Recommendation[] = [];
    
    // 1. Strength-based recommendations
    const strengthRecs = this.analyzeStrengthProgress(metrics.strengthGains);
    recommendations.push(...strengthRecs);
    
    // 2. Volume-based recommendations
    const volumeRecs = this.analyzeVolumeProgress(metrics.volumeProgression);
    recommendations.push(...volumeRecs);
    
    // 3. Consistency recommendations
    if (metrics.consistencyScore < 0.7) {
      recommendations.push(this.generateConsistencyRecommendation(metrics.consistencyScore));
    }
    
    // 4. Recovery recommendations
    if (metrics.recoveryScore < 0.6) {
      recommendations.push(this.generateRecoveryRecommendation(metrics.recoveryScore));
    }
    
    // 5. AI-powered personalized recommendations
    const aiRecs = await this.generateAIRecommendations(userId, metrics, context);
    recommendations.push(...aiRecs);
    
    // Sort by priority
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async calculateProgressMetrics(
    userId: string,
    context: AIAnalysisContext
  ): Promise<ProgressMetrics> {
    // TODO: Implement comprehensive metrics calculation
    // This should analyze training data over the specified time range
    
    return {
      strengthGains: {
        bench_press: 12.5, // 12.5% increase
        squat: 15.0,
        deadlift: 10.0,
        overhead_press: 8.0,
      },
      volumeProgression: {
        chest: 20.0,
        back: 15.0,
        legs: 25.0,
        shoulders: 10.0,
      },
      consistencyScore: 0.85,
      recoveryScore: 0.75,
    };
  }

  private analyzeStrengthProgress(
    strengthGains: Record<string, number>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const avgGain = Object.values(strengthGains).reduce((sum, gain) => sum + gain, 0) / Object.keys(strengthGains).length;
    
    if (avgGain < 5) {
      recommendations.push({
        category: 'training',
        priority: 'high',
        title: 'Strength Progression Stalled',
        description: 'Your strength gains have plateaued. Consider implementing progressive overload strategies.',
        actionItems: [
          'Increase weight by 2.5-5% when you can complete all sets with good form',
          'Try different rep ranges (3-5 for strength, 6-12 for hypertrophy)',
          'Implement periodization with strength and volume phases',
          'Ensure adequate protein intake (0.8-1g per lb bodyweight)',
        ],
      });
    }
    
    // Identify lagging lifts
    const laggingLifts = Object.entries(strengthGains)
      .filter(([_, gain]) => gain < avgGain * 0.5)
      .map(([lift, _]) => lift);
    
    if (laggingLifts.length > 0) {
      recommendations.push({
        category: 'technique',
        priority: 'medium',
        title: 'Address Lagging Lifts',
        description: `The following lifts are progressing slower: ${laggingLifts.join(', ')}`,
        actionItems: [
          'Review and improve technique with video analysis',
          'Add accessory exercises targeting weak points',
          'Increase frequency for lagging lifts',
          'Consider working with a coach for form check',
        ],
      });
    }
    
    return recommendations;
  }

  private analyzeVolumeProgress(
    volumeProgression: Record<string, number>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Check for excessive volume increases
    const rapidIncreases = Object.entries(volumeProgression)
      .filter(([_, increase]) => increase > 30)
      .map(([muscle, _]) => muscle);
    
    if (rapidIncreases.length > 0) {
      recommendations.push({
        category: 'training',
        priority: 'high',
        title: 'Rapid Volume Increase Detected',
        description: `Volume increased rapidly for: ${rapidIncreases.join(', ')}. This may increase injury risk.`,
        actionItems: [
          'Limit volume increases to 10-20% per week',
          'Monitor for signs of overtraining',
          'Consider a deload week',
          'Ensure proper warm-up and mobility work',
        ],
      });
    }
    
    return recommendations;
  }

  private generateConsistencyRecommendation(
    consistencyScore: number
  ): Recommendation {
    const missedPercentage = Math.round((1 - consistencyScore) * 100);
    
    return {
      category: 'training',
      priority: 'medium',
      title: 'Improve Training Consistency',
      description: `You've missed approximately ${missedPercentage}% of planned workouts.`,
      actionItems: [
        'Set realistic training frequency goals',
        'Schedule workouts at consistent times',
        'Prepare gym bag the night before',
        'Find an accountability partner',
        'Track workouts in a visible calendar',
      ],
    };
  }

  private generateRecoveryRecommendation(
    recoveryScore: number
  ): Recommendation {
    return {
      category: 'recovery',
      priority: 'high',
      title: 'Optimize Recovery',
      description: 'Your recovery metrics indicate suboptimal recuperation between sessions.',
      actionItems: [
        'Aim for 7-9 hours of quality sleep',
        'Include active recovery days',
        'Stay hydrated (0.5-1oz per lb bodyweight)',
        'Consider massage or foam rolling',
        'Monitor stress levels and practice relaxation',
        'Ensure adequate nutrition timing post-workout',
      ],
    };
  }

  private async generateAIRecommendations(
    userId: string,
    metrics: ProgressMetrics,
    context: AIAnalysisContext
  ): Promise<Recommendation[]> {
    const prompt = `
Based on the following training progress metrics for a user:
${JSON.stringify(metrics, null, 2)}

Context: ${JSON.stringify(context)}

Generate 2-3 specific, actionable recommendations to improve their training results.
Consider their current progress, potential bottlenecks, and evidence-based training principles.

Format each recommendation as JSON with: category, priority, title, description, actionItems (array).
`;

    try {
      const response = await this.ai.run("@cf/meta/llama-3-8b-instruct", {
        prompt,
        max_tokens: 600,
      });

      return this.parseAIRecommendations(response);
    } catch (error) {
      console.error("AI recommendation generation failed:", error);
      return [];
    }
  }

  private parseAIRecommendations(response: any): Recommendation[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.response?.match(/\[[^\]]+\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate each recommendation
        return parsed
          .filter((rec: any) => 
            rec.category && rec.priority && rec.title && 
            rec.description && Array.isArray(rec.actionItems)
          )
          .map((rec: any) => ({
            category: rec.category,
            priority: rec.priority,
            title: rec.title,
            description: rec.description,
            actionItems: rec.actionItems,
          }));
      }
    } catch (error) {
      console.error("Failed to parse AI recommendations:", error);
    }
    
    return [];
  }
}