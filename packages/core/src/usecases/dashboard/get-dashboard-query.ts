import { type Result, type UserIdVO, err, ok } from "@bulktrack/shared-kernel";
import type { DashboardRepository } from "../../domain/dashboard/repository";

export interface GetDashboardQueryParams {
  userId: string;
  span: "1w" | "4w" | "8w" | "12w" | "24w";
  language: string;
}

export interface WeekPoint {
  weekStart: string;
  totalVolume: number;
  avgSetVolume?: number;
  e1rmAvg?: number | null;
}

export interface MuscleGroupSeries {
  muscleGroupId: number;
  groupName: string;
  points: MuscleGroupWeekPoint[];
}

export interface MuscleGroupWeekPoint {
  weekStart: string;
  totalVolume: number;
  setCount: number;
  avgE1rm?: number | null;
}

export interface MetricSeries {
  metricKey: string;
  unit: string;
  points: MetricPoint[];
}

export interface MetricPoint {
  weekStart: string;
  value: number;
}

export interface DashboardData {
  thisWeek: WeekPoint;
  lastWeek: WeekPoint;
  trend: WeekPoint[];
  muscleGroups: MuscleGroupSeries[];
  metrics: MetricSeries[];
}

export class GetDashboardQuery {
  constructor(private repository: DashboardRepository) {}

  async execute(
    params: GetDashboardQueryParams,
  ): Promise<Result<DashboardData, Error>> {
    try {
      // Calculate date ranges
      const now = new Date();
      const currentWeekStart = this.getWeekStart(now);
      const lastWeekStart = new Date(currentWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      // Calculate span in weeks
      const spanWeeks = Number.parseInt(params.span.slice(0, -1));
      const spanStartDate = new Date(currentWeekStart);
      spanStartDate.setDate(spanStartDate.getDate() - spanWeeks * 7 + 7);

      // Fetch this week's data
      const thisWeekResult = await this.repository.getWeeklyVolume(
        params.userId,
        currentWeekStart,
        params.language,
      );

      if (thisWeekResult.isErr()) {
        return err(thisWeekResult.error);
      }

      // Fetch last week's data
      const lastWeekResult = await this.repository.getWeeklyVolume(
        params.userId,
        lastWeekStart,
        params.language,
      );

      if (lastWeekResult.isErr()) {
        return err(lastWeekResult.error);
      }

      // Fetch trend data
      const trendResult = await this.repository.getWeeklyVolumeTrend(
        params.userId,
        spanStartDate,
        currentWeekStart,
        params.language,
      );

      if (trendResult.isErr()) {
        return err(trendResult.error);
      }

      // Fetch muscle group data
      const muscleGroupResult = await this.repository.getMuscleGroupVolumes(
        params.userId,
        spanStartDate,
        currentWeekStart,
        params.language,
      );

      if (muscleGroupResult.isErr()) {
        return err(muscleGroupResult.error);
      }

      // TODO: Fetch metrics data when implemented
      const metrics: MetricSeries[] = [];

      // Fill missing weeks with zeros
      const filledTrend = this.fillMissingWeeks(
        trendResult.unwrap(),
        spanStartDate,
        currentWeekStart,
      );

      const filledMuscleGroups = this.fillMissingMuscleGroupWeeks(
        muscleGroupResult.unwrap(),
        spanStartDate,
        currentWeekStart,
      );

      // Consolidate Hip & Glutes (ID: 6) and Legs (ID: 7) into "Legs"
      const consolidatedMuscleGroups = this.consolidateLegMuscles(
        filledMuscleGroups,
        params.language,
      );

      return ok({
        thisWeek:
          thisWeekResult.unwrap() ||
          this.createEmptyWeekPoint(currentWeekStart),
        lastWeek:
          lastWeekResult.unwrap() || this.createEmptyWeekPoint(lastWeekStart),
        trend: filledTrend,
        muscleGroups: consolidatedMuscleGroups,
        metrics,
      });
    } catch (error) {
      return err(new Error(`Failed to get dashboard data: ${error}`));
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
    d.setDate(diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private createEmptyWeekPoint(weekStart: Date): WeekPoint {
    return {
      weekStart: weekStart.toISOString().split("T")[0],
      totalVolume: 0,
      avgSetVolume: 0,
      e1rmAvg: null,
    };
  }

  private fillMissingWeeks(
    data: WeekPoint[],
    startDate: Date,
    endDate: Date,
  ): WeekPoint[] {
    const filled: WeekPoint[] = [];
    const dataMap = new Map(data.map((point) => [point.weekStart, point]));

    const current = new Date(startDate);
    while (current <= endDate) {
      const weekStart = current.toISOString().split("T")[0];
      filled.push(dataMap.get(weekStart) || this.createEmptyWeekPoint(current));
      current.setDate(current.getDate() + 7);
    }

    return filled;
  }

  private fillMissingMuscleGroupWeeks(
    data: MuscleGroupSeries[],
    startDate: Date,
    endDate: Date,
  ): MuscleGroupSeries[] {
    return data.map((series) => ({
      ...series,
      points: this.fillMissingMuscleGroupPoints(
        series.points,
        startDate,
        endDate,
      ),
    }));
  }

  private fillMissingMuscleGroupPoints(
    points: MuscleGroupWeekPoint[],
    startDate: Date,
    endDate: Date,
  ): MuscleGroupWeekPoint[] {
    const filled: MuscleGroupWeekPoint[] = [];
    const pointMap = new Map(points.map((point) => [point.weekStart, point]));

    const current = new Date(startDate);
    while (current <= endDate) {
      const weekStart = current.toISOString().split("T")[0];
      filled.push(
        pointMap.get(weekStart) || {
          weekStart,
          totalVolume: 0,
          setCount: 0,
          avgE1rm: null,
        },
      );
      current.setDate(current.getDate() + 7);
    }

    return filled;
  }

  private consolidateLegMuscles(
    muscleGroups: MuscleGroupSeries[],
    language: string,
  ): MuscleGroupSeries[] {
    const hipGlutes = muscleGroups.find((g) => g.muscleGroupId === 6);
    const legs = muscleGroups.find((g) => g.muscleGroupId === 7);

    if (!hipGlutes || !legs) {
      // If either is missing, return as-is but filter out ID 6
      return muscleGroups.filter((g) => g.muscleGroupId !== 6);
    }

    // Combine Hip & Glutes into Legs
    const consolidatedLegs: MuscleGroupSeries = {
      muscleGroupId: 7,
      groupName: this.getLegsTranslation(language),
      points: legs.points.map((legPoint, index) => {
        const hipPoint = hipGlutes.points[index];
        if (!hipPoint) return legPoint;

        return {
          weekStart: legPoint.weekStart,
          totalVolume: legPoint.totalVolume + hipPoint.totalVolume,
          setCount: legPoint.setCount + hipPoint.setCount,
          avgE1rm: this.calculateAvgE1rm(legPoint, hipPoint),
        };
      }),
    };

    // Return all groups except Hip & Glutes (ID: 6)
    return muscleGroups
      .filter((g) => g.muscleGroupId !== 6 && g.muscleGroupId !== 7)
      .concat(consolidatedLegs);
  }

  private getLegsTranslation(language: string): string {
    // Simple translation logic
    if (language.startsWith("ja")) {
      return "脚";
    }
    return "Legs";
  }

  private calculateAvgE1rm(
    point1: MuscleGroupWeekPoint,
    point2: MuscleGroupWeekPoint,
  ): number | null {
    const e1rm1 = point1.avgE1rm ?? null;
    const e1rm2 = point2.avgE1rm ?? null;

    if (e1rm1 === null && e1rm2 === null) return null;
    if (e1rm1 === null) return e1rm2;
    if (e1rm2 === null) return e1rm1;

    const totalSets = point1.setCount + point2.setCount;
    if (totalSets === 0) return null;

    return (e1rm1 * point1.setCount + e1rm2 * point2.setCount) / totalSets;
  }
}
