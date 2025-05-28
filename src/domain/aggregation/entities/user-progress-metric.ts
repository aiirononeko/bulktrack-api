import type { UserIdVO } from "../../shared/vo/identifier";

export type MetricType = "kg" | "percentage" | "boolean" | "json" | string; // schema.ts には型がないので柔軟に

export interface IUserProgressMetricProps {
  userId: UserIdVO;
  metricKey: string; // 例: "exercise_squat_1rm_estimate"
  periodIdentifier: string; // 例: "2023-W52"
  metricValue: string; // schema.ts では TEXT 型なので string
  metricType?: MetricType;
  calculatedAt: Date;
}

export class UserProgressMetric {
  readonly userId: UserIdVO;
  readonly metricKey: string;
  readonly periodIdentifier: string;
  readonly metricValue: string;
  readonly metricType?: MetricType;
  readonly calculatedAt: Date;

  constructor(props: IUserProgressMetricProps) {
    // バリデーション例
    if (!props.metricKey.trim()) {
      throw new Error("Metric key cannot be empty.");
    }
    if (!props.metricValue.trim()) {
      // metricValueも必須と仮定
      throw new Error("Metric value cannot be empty.");
    }
    this.userId = props.userId;
    this.metricKey = props.metricKey;
    this.periodIdentifier = props.periodIdentifier;
    this.metricValue = props.metricValue;
    this.metricType = props.metricType;
    this.calculatedAt = props.calculatedAt;
  }

  // 必要に応じてメソッドを追加 (例: toDTO, getParsedValue など)
  // public getParsedValue(): number | string | boolean | object {
  //   if (this.metricType === "kg" || this.metricType === "percentage") {
  //     return parseFloat(this.metricValue);
  //   }
  //   if (this.metricType === "boolean") {
  //     return this.metricValue.toLowerCase() === "true";
  //   }
  //   if (this.metricType === "json") {
  //     try {
  //       return JSON.parse(this.metricValue);
  //     } catch (e) {
  //       console.error("Failed to parse metricValue as JSON", e);
  //       return this.metricValue; // or throw
  //     }
  //   }
  //   return this.metricValue;
  // }
}
