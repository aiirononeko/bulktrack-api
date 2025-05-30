import type { Ai } from "@cloudflare/ai";
import type {
  AIAnalysisContext,
  VolumeOptimizationMessage,
  AdjustmentPlan,
} from "@bulktrack/queue-types";
import type {
  LoadDistributionCalculator,
  VolumeCalculator,
} from "@bulktrack/scientific-calc";

export class VolumeOptimizationAnalyzer {
  constructor(
    private db: any,
    private ai: Ai,
    private calculators: ReturnType<typeof import("@bulktrack/scientific-calc").createCalculators>
  ) {}

  async analyze(
    userId: string,
    context: AIAnalysisContext
  ): Promise<Partial<VolumeOptimizationMessage> | null> {
    // Fetch current training volume distribution
    const currentDistribution = await this.getCurrentDistribution(userId, context);
    
    if (!currentDistribution || Object.keys(currentDistribution).length === 0) {
      return null;
    }

    // Calculate optimal distribution based on user goals and research
    const optimalDistribution = await this.calculateOptimalDistribution(
      userId,
      currentDistribution,
      context
    );

    // Generate adjustment plan
    const adjustmentPlan = this.generateAdjustmentPlan(
      currentDistribution,
      optimalDistribution
    );

    // Only return if significant adjustments are needed
    const significantChanges = adjustmentPlan.some(
      plan => Math.abs(plan.targetVolume - plan.currentVolume) / plan.currentVolume > 0.1
    );

    if (!significantChanges) {
      return null;
    }

    return {
      userId,
      currentDistribution,
      optimalDistribution,
      adjustmentPlan,
    };
  }

  private async getCurrentDistribution(
    userId: string,
    context: AIAnalysisContext
  ): Promise<Record<string, number>> {
    // TODO: Query database for current volume distribution by muscle group
    // This should aggregate volume data from the specified time range
    
    // Placeholder implementation
    const mockDistribution: Record<string, number> = {
      chest: 10000,
      back: 12000,
      shoulders: 8000,
      biceps: 6000,
      triceps: 5000,
      legs: 15000,
      core: 3000,
    };

    return mockDistribution;
  }

  private async calculateOptimalDistribution(
    userId: string,
    currentDistribution: Record<string, number>,
    context: AIAnalysisContext
  ): Promise<Record<string, number>> {
    // Get user goals and preferences
    const userGoals = await this.getUserGoals(userId);
    
    // Base optimal distribution on scientific recommendations
    const baseOptimal = this.getScientificOptimalDistribution(userGoals);
    
    // Adjust based on individual response and AI analysis
    const aiAdjusted = await this.adjustWithAI(
      currentDistribution,
      baseOptimal,
      context
    );

    return aiAdjusted;
  }

  private async getUserGoals(userId: string): Promise<any> {
    // TODO: Fetch user goals from database
    return {
      primaryGoal: "hypertrophy",
      experience: "intermediate",
      weakPoints: ["shoulders", "biceps"],
    };
  }

  private getScientificOptimalDistribution(goals: any): Record<string, number> {
    // Based on Schoenfeld et al. (2019) recommendations for hypertrophy
    const baseDistribution: Record<string, number> = {
      chest: 12, // 12% of total volume
      back: 18, // Larger muscle group, needs more volume
      shoulders: 10,
      biceps: 8,
      triceps: 8,
      legs: 35, // Largest muscle group
      core: 9,
    };

    // Adjust for weak points
    if (goals.weakPoints) {
      goals.weakPoints.forEach((muscle: string) => {
        if (baseDistribution[muscle]) {
          baseDistribution[muscle] *= 1.2; // 20% increase for weak points
        }
      });
    }

    // Normalize to ensure total is 100%
    const total = Object.values(baseDistribution).reduce((sum, val) => sum + val, 0);
    Object.keys(baseDistribution).forEach(muscle => {
      baseDistribution[muscle] = (baseDistribution[muscle] / total) * 100;
    });

    return baseDistribution;
  }

  private async adjustWithAI(
    current: Record<string, number>,
    optimal: Record<string, number>,
    context: AIAnalysisContext
  ): Promise<Record<string, number>> {
    const prompt = `
Given the current muscle volume distribution:
${JSON.stringify(current, null, 2)}

And the scientifically optimal distribution:
${JSON.stringify(optimal, null, 2)}

Context: ${JSON.stringify(context)}

Suggest any adjustments considering individual factors, recovery capacity, and training history.
Return a JSON object with muscle groups as keys and percentage values.
`;

    try {
      const response = await this.ai.run("@cf/meta/llama-3-8b-instruct", {
        prompt,
        max_tokens: 300,
      });

      // Parse AI response
      const adjusted = this.parseAIDistribution(response, optimal);
      return adjusted;
    } catch (error) {
      console.error("AI adjustment failed:", error);
      return optimal; // Fallback to scientific optimal
    }
  }

  private generateAdjustmentPlan(
    current: Record<string, number>,
    optimal: Record<string, number>
  ): AdjustmentPlan[] {
    const totalVolume = Object.values(current).reduce((sum, val) => sum + val, 0);
    const plans: AdjustmentPlan[] = [];

    Object.keys(current).forEach(muscle => {
      const currentVolume = current[muscle];
      const optimalPercentage = optimal[muscle] || 0;
      const targetVolume = (optimalPercentage / 100) * totalVolume;
      
      if (Math.abs(targetVolume - currentVolume) > currentVolume * 0.05) {
        const weeklyChange = (targetVolume - currentVolume) / 4; // 4-week adjustment
        
        plans.push({
          muscleGroup: muscle,
          currentVolume,
          targetVolume,
          weeklyIncrement: weeklyChange,
          reasoning: this.generateReasoning(muscle, currentVolume, targetVolume),
        });
      }
    });

    return plans;
  }

  private generateReasoning(
    muscle: string,
    current: number,
    target: number
  ): string {
    const percentChange = ((target - current) / current) * 100;
    
    if (percentChange > 0) {
      return `Increase ${muscle} volume by ${Math.abs(percentChange).toFixed(1)}% to optimize growth stimulus based on current recovery capacity and training response.`;
    } else {
      return `Reduce ${muscle} volume by ${Math.abs(percentChange).toFixed(1)}% to prevent overtraining and improve recovery for other muscle groups.`;
    }
  }

  private parseAIDistribution(
    response: any,
    fallback: Record<string, number>
  ): Record<string, number> {
    try {
      // Extract JSON from AI response
      const jsonMatch = response.response?.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and normalize
        const total = Object.values(parsed).reduce((sum: number, val: any) => sum + Number(val), 0);
        if (total > 0) {
          Object.keys(parsed).forEach(key => {
            parsed[key] = (Number(parsed[key]) / total) * 100;
          });
          return parsed;
        }
      }
    } catch (error) {
      console.error("Failed to parse AI distribution:", error);
    }
    
    return fallback;
  }
}