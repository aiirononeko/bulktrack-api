import { Hono } from "hono";
import type {
  DashboardDataDto,
  WeeklyUserMetricDto,
  WeeklyUserMuscleVolumeDto,
  WeeklyUserVolumeDto,
} from "../../../../application/query/dashboard/dto";
import {
  GetDashboardDataQuery,
  type GetDashboardDataQueryHandler,
} from "../../../../application/query/dashboard/get-dashboard-data";
// IDashboardRepository and DashboardRepository imports are no longer needed here as DI is handled upstream.
// import type { IDashboardRepository } from '../../../../domain/dashboard/repository';
// import { DashboardRepository } from '../../../../infrastructure/db/repository/dashboard-repository';
// import { authenticate } from '../../middleware/auth'; // Assuming auth middleware
import {
  generateWeeklyDateRange,
  getISOWeekMondayString as getUtilsIsoWeekMondayString,
} from "../../../../application/utils/date-utils";
// Import AppEnv from router.ts to correctly type c.var
// This might create a circular dependency if AppEnv itself imports this file.
// If so, AppEnv should be moved to a shared types file.
import type { AppEnv } from "../../main.router"; // Correct path to main.router.ts

// The HonoEnv specific to this file can be removed if AppEnv from router.ts is accessible
// or if Hono can infer it. For clarity, if AppEnv is not directly imported,
// we can simplify or rely on inference. Assuming Hono<any> or Hono<{ Variables: { ... } } > if specific vars are accessed.
// For now, let router.ts define the AppEnv and this app will implicitly use it when routed.

// When this app is mounted in router.ts, it will inherit the AppEnv context from the parent.
// So, c.var.dashboardQueryHandler and c.var.userId will be typed according to AppEnv in router.ts.
const dashboardStatsApp = new Hono<AppEnv>();

// DI middleware is removed as it's now handled in src/interface/http/router.ts

// --- OpenAPI Response Type Definitions (should ideally be generated or in a shared types file) ---
type WeekPoint = {
  weekStart: string; // YYYY-MM-DD
  totalVolume: number;
  avgSetVolume?: number | null;
  e1rmAvg?: number | null;
  // ↓ MuscleSeriesのpointsでのみ使用するため、WeekPointの共通定義からは削除し、muscles.points作成時に直接追加する
  // setCount?: number | null;
  // avgMuscleSetE1rm?: number | null;
};

// MuscleSeriesのpointsで使用する型を別途定義も検討できるが、今回は WeekPoint にオプショナルで含める形を維持
// 代わりに、muscles.points で使用するプロパティを明確にするため、muscles.pointsの型を拡張する
// type MuscleWeekPoint = WeekPoint & { // MuscleWeekPoint は不要になるか、 MuscleGroupWeekPoint に改名
//   setCount?: number | null;
//   avgMuscleSetE1rm?: number | null;
// };

// type MuscleSeries = { // MuscleGroupSeries に改名
//   muscleId: number;
//   name: string;
//   points: MuscleWeekPoint[];
// };

type MuscleGroupWeekPoint = {
  weekStart: string; // YYYY-MM-DD
  totalVolume: number; // グループの総ボリューム
  setCount: number; // グループの総セット数
  avgE1rm?: number | null; // グループの平均e1RM (e1rmSum / e1rmCount)
};

type MuscleGroupSeries = {
  muscleGroupId: number;
  groupName: string;
  points: MuscleGroupWeekPoint[];
};

type MetricPoint = {
  weekStart: string; // YYYY-MM-DD
  value: number;
};

type MetricSeries = {
  metricKey: string;
  unit: string;
  points: MetricPoint[];
};

type DashboardResponse = {
  userId: string;
  span: string; // e.g., "1w", "4w"
  thisWeek: WeekPoint;
  lastWeek: WeekPoint;
  trend: WeekPoint[];
  muscleGroups: MuscleGroupSeries[];
  metrics: MetricSeries[];
};
// --- End OpenAPI Response Type Definitions ---

// --- Helper Functions ---
// getWeekStartDate 関数は date-utils の getISOWeekMondayString を使うため削除
// function getWeekStartDate(date: Date): Date {
//   const d = new Date(date);
//   const day = d.getDay(); // Sunday - Saturday : 0 - 6
//   const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
//   d.setDate(diff);
//   d.setHours(0, 0, 0, 0); // Normalize to start of day
//   return d;
// }

// getISODateString も date-utils の getISOWeekMondayString が YYYY-MM-DD 文字列を返すので、用途によっては不要になる
// function getISODateString(date: Date): string {
//   return date.toISOString().split('T')[0];
// }

function calculateDateRangeFromSpan(span: string): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  // const currentWeekMonday = getWeekStartDate(now); // 削除
  const currentWeekMondayIsoString = getUtilsIsoWeekMondayString(now);
  const currentWeekMonday = new Date(`${currentWeekMondayIsoString}T00:00:00Z`); // UTCとしてパース

  const endDateForPeriod = new Date(currentWeekMonday.valueOf()); // valueOf() を使ってコピー
  endDateForPeriod.setUTCDate(endDateForPeriod.getUTCDate() + 6); // End of current week (Sunday)

  let weeksToSubtract = 1; // Default to 1w
  const spanMatch = /(\d+)w/.exec(span); // Corrected regex escape
  if (spanMatch?.[1]) {
    weeksToSubtract = Number.parseInt(spanMatch[1], 10);
  }

  const startDateForPeriod = new Date(currentWeekMonday.valueOf()); // valueOf() を使ってコピー
  // startDateForPeriod.setUTCDate(startDateForPeriod.getUTCDate() - (weeksToSubtract - 1) * 7 * 24 * 60 * 60 * 1000); // UTCで日付操作
  startDateForPeriod.setUTCDate(
    startDateForPeriod.getUTCDate() - (weeksToSubtract - 1) * 7,
  ); // Corrected: subtract days

  return {
    startDate: getUtilsIsoWeekMondayString(startDateForPeriod), // YYYY-MM-DD文字列を直接使用
    // endDate: getUtilsIsoWeekMondayString(endDateForPeriod), // YYYY-MM-DD文字列を直接使用
    endDate: endDateForPeriod.toISOString().split("T")[0], // Corrected: Use the actual Sunday's date string
  };
}

function getPreviousWeekStartDateString(currentWeekStartStr: string): string {
  const currentWeekStartDate = new Date(`${currentWeekStartStr}T00:00:00Z`); // UTCとしてパース
  const previousWeekStartDate = new Date(currentWeekStartDate.valueOf());
  previousWeekStartDate.setUTCDate(previousWeekStartDate.getUTCDate() - 7);
  return getUtilsIsoWeekMondayString(previousWeekStartDate); // YYYY-MM-DD文字列を直接使用
}

// --- End Helper Functions ---

// --- Mapping Function DTO to OpenAPI Response ---
function toWeekPoint(volumeDto?: WeeklyUserVolumeDto | null): WeekPoint | null {
  if (!volumeDto) return null;
  return {
    weekStart: volumeDto.weekStart,
    totalVolume: volumeDto.totalVolume,
    avgSetVolume: volumeDto.avgSetVolume,
    e1rmAvg: volumeDto.e1rmAvg,
    // setCount や avgMuscleSetE1rm はここでは設定しない
  };
}

function mapDtoToResponse(
  dto: DashboardDataDto,
  userIdInput: string,
  requestedSpan: string,
): DashboardResponse {
  // const currentIsoWeekStartDate = getISODateString(getWeekStartDate(new Date())); // 変更
  const currentIsoWeekStartDate = getUtilsIsoWeekMondayString(new Date());

  // historicalWeeklyVolumes を一度 WeekPoint[] に変換し、ソートする (thisWeek, lastWeek, trend で共通利用)
  const allWeeklyVolumePoints: WeekPoint[] = (dto.historicalWeeklyVolumes ?? [])
    .map(toWeekPoint)
    .filter((wp): wp is WeekPoint => wp !== null) // Type guard to filter out nulls
    .sort(
      (a, b) =>
        new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime(),
    );

  // thisWeek - allWeeklyVolumePoints から今週のデータを検索
  const thisWeekDataFromAllVolumes = allWeeklyVolumePoints.find(
    (t) => t.weekStart === currentIsoWeekStartDate,
  );
  const thisWeek: WeekPoint = thisWeekDataFromAllVolumes ?? {
    weekStart: currentIsoWeekStartDate,
    totalVolume: 0,
    avgSetVolume: 0,
    e1rmAvg: null,
  };

  // lastWeek - allWeeklyVolumePoints から先週のデータを検索
  // const lastWeekStartDateStr = getPreviousWeekStartDateString(thisWeek.weekStart); // thisWeek.weekStartは上記で変動可能性あり
  const lastWeekStartDateStr = getPreviousWeekStartDateString(
    currentIsoWeekStartDate,
  ); // currentIsoWeekStartDate を基準にする
  const lastWeekDataFromAllVolumes = allWeeklyVolumePoints.find(
    (v) => v.weekStart === lastWeekStartDateStr,
  );
  const lastWeek: WeekPoint = lastWeekDataFromAllVolumes ?? {
    weekStart: lastWeekStartDateStr,
    totalVolume: 0,
    avgSetVolume: 0,
    e1rmAvg: null,
  };

  // trend - allWeeklyVolumePoints をそのまま使用
  const trend: WeekPoint[] = allWeeklyVolumePoints;

  // muscles から muscleGroups に変更
  const muscleGroupsData: {
    [groupId: number]: {
      groupName?: string;
      pointsMap: Map<
        string,
        {
          weekStart: string;
          totalVolume: number;
          setCount: number;
          e1rmSum: number;
          e1rmCount: number;
        }
      >;
    };
  } = {};

  for (const mVol of dto.historicalWeeklyMuscleVolumes ?? []) {
    if (mVol.muscleGroupId === undefined || mVol.muscleGroupId === null)
      continue; // muscleGroupId がないデータはスキップ

    if (!muscleGroupsData[mVol.muscleGroupId]) {
      muscleGroupsData[mVol.muscleGroupId] = {
        groupName: mVol.muscleGroupName,
        pointsMap: new Map(),
      };
    }

    let pointData = muscleGroupsData[mVol.muscleGroupId].pointsMap.get(
      mVol.weekStart,
    );
    if (!pointData) {
      pointData = {
        weekStart: mVol.weekStart,
        totalVolume: 0,
        setCount: 0,
        e1rmSum: 0,
        e1rmCount: 0,
      };
    }

    pointData.totalVolume += mVol.volume; // ボリュームは単純加算
    pointData.setCount += mVol.setCount; // セット数も単純加算
    pointData.e1rmSum += mVol.e1rmSum;
    pointData.e1rmCount += mVol.e1rmCount;

    muscleGroupsData[mVol.muscleGroupId].pointsMap.set(
      mVol.weekStart,
      pointData,
    );
  }

  const muscleGroups: MuscleGroupSeries[] = Object.entries(
    muscleGroupsData,
  ).map(([id, data]) => {
    const points: MuscleGroupWeekPoint[] = Array.from(data.pointsMap.values())
      .map((p) => {
        let avgE1rm: number | null = null;
        if (p.e1rmCount > 0 && p.e1rmSum !== null) {
          avgE1rm = Number.parseFloat((p.e1rmSum / p.e1rmCount).toFixed(2));
        }
        return {
          weekStart: p.weekStart,
          totalVolume: p.totalVolume,
          setCount: p.setCount,
          avgE1rm: avgE1rm,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime(),
      );

    return {
      muscleGroupId: Number.parseInt(id, 10),
      groupName: data.groupName ?? "Unknown Muscle Group",
      points: points,
    };
  });

  // metrics
  const metricsData: {
    [key: string]: { unit?: string | null; points: MetricPoint[] };
  } = {};
  for (const metric of dto.historicalMetrics ?? []) {
    if (!metricsData[metric.metricKey]) {
      metricsData[metric.metricKey] = { unit: metric.metricUnit, points: [] };
    }
    metricsData[metric.metricKey].points.push({
      weekStart: metric.weekStart,
      value: metric.metricValue,
    });
  }
  const metrics: MetricSeries[] = Object.entries(metricsData).map(
    ([key, data]) => ({
      metricKey: key,
      unit: data.unit ?? "",
      points: data.points.sort(
        (a, b) =>
          new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime(),
      ),
    }),
  );

  return {
    userId: userIdInput,
    span: requestedSpan,
    thisWeek,
    lastWeek,
    trend,
    muscleGroups,
    metrics,
  };
}
// --- End Mapping Function ---

dashboardStatsApp.get(
  "/",
  /* authenticate, */ async (c) => {
    // authenticate will be applied in router.ts
    try {
      // userId should be populated by jwtAuthMiddleware in router.ts via jwtPayload
      const jwtTokenPayload = c.var.jwtPayload;
      const userId = jwtTokenPayload?.sub || "test-user-id-fallback";

      if (!userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // 'period' または 'span' クエリパラメータを取得し、それに基づいて日付範囲を計算
      const periodOrSpanQuery = c.req.query("period") || c.req.query("span");
      const requestedSpan = periodOrSpanQuery || "1w"; // APIレスポンスで使用するspan

      let queryStartDate = c.req.query("startDate");
      let queryEndDate = c.req.query("endDate");

      if (periodOrSpanQuery && (!queryStartDate || !queryEndDate)) {
        // period/span が指定されていて、かつ startDate/endDate が直接指定されていない場合、日付範囲を計算
        const range = calculateDateRangeFromSpan(periodOrSpanQuery);
        queryStartDate = range.startDate;
        queryEndDate = range.endDate;
      }

      const { metricKeys: metricKeysQuery } = c.req.query();
      let metricKeys: string[] | undefined;
      if (
        typeof metricKeysQuery === "string" &&
        metricKeysQuery.trim() !== ""
      ) {
        metricKeys = metricKeysQuery
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k !== "");
      } else if (Array.isArray(metricKeysQuery)) {
        metricKeys = metricKeysQuery
          .map((k) => k.trim())
          .filter((k) => k !== "");
        if (metricKeys.length === 0) metricKeys = undefined;
      }

      // Extract preferred language from Accept-Language header
      const acceptLanguage = c.req.header("Accept-Language");
      const preferredLocale =
        acceptLanguage?.split(",")[0]?.split("-")[0]?.toLowerCase() || "en";

      const query = new GetDashboardDataQuery(
        userId,
        queryStartDate,
        queryEndDate,
        metricKeys,
        preferredLocale,
      );

      // dashboardQueryHandler should be populated by DI middleware in router.ts
      // The type for c.var.dashboardQueryHandler will come from AppEnv in router.ts.
      const handler = c.var.dashboardQueryHandler;

      if (!handler) {
        console.error(
          "Dashboard query handler not initialized. This should be set by upstream middleware.",
        );
        return c.json(
          { error: "Internal server error: Handler not available." },
          500,
        );
      }

      const dashboardDto: DashboardDataDto = await handler.execute(query);

      // Apply muscle group aggregation service to combine Hip & Glutes (6) and Legs (7) into Legs
      const aggregationService = c.var.dashboardMuscleGroupAggregationService;
      if (!aggregationService) {
        console.error(
          "Dashboard muscle group aggregation service not initialized. This should be set by upstream middleware.",
        );
        return c.json(
          {
            error: "Internal server error: Aggregation service not available.",
          },
          500,
        );
      }

      const aggregatedDto: DashboardDataDto =
        aggregationService.aggregateLegMuscleGroups(
          dashboardDto,
          preferredLocale,
        );

      // Apply data completion service to fill missing weeks with default values
      const completionService = c.var.dashboardDataCompletionService;
      if (!completionService) {
        console.error(
          "Dashboard data completion service not initialized. This should be set by upstream middleware.",
        );
        return c.json(
          { error: "Internal server error: Completion service not available." },
          500,
        );
      }

      const completedDto: DashboardDataDto =
        await completionService.completeWeeklyData(
          aggregatedDto,
          requestedSpan,
          userId,
          preferredLocale,
        );

      // Map DTO to the OpenAPI response structure
      const responsePayload: DashboardResponse = mapDtoToResponse(
        completedDto,
        userId,
        requestedSpan,
      );

      return c.json(responsePayload);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      if (error instanceof Error) {
        return c.json(
          {
            error: "Failed to fetch dashboard statistics",
            details: error.message,
          },
          500,
        );
      }
      return c.json({ error: "Failed to fetch dashboard statistics" }, 500);
    }
  },
);

export default dashboardStatsApp;
