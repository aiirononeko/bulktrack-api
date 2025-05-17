import { Hono } from 'hono';
// Import AppEnv from router.ts to correctly type c.var
// This might create a circular dependency if AppEnv itself imports this file.
// If so, AppEnv should be moved to a shared types file.
import type { AppEnv } from '../../router'; // Assuming router.ts exports AppEnv
import { type GetDashboardDataQueryHandler, GetDashboardDataQuery } from '../../../../app/query/dashboard/get-dashboard-data';
import type { DashboardDataDto, WeeklyUserVolumeDto, WeeklyUserMuscleVolumeDto, WeeklyUserMetricDto } from '../../../../app/query/dashboard/dto';
// IDashboardRepository and DashboardRepository imports are no longer needed here as DI is handled upstream.
// import type { IDashboardRepository } from '../../../../domain/dashboard/repository';
// import { DashboardRepository } from '../../../../infrastructure/db/repository/dashboard-repository';
// import { authenticate } from '../../middleware/auth'; // Assuming auth middleware

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
  avgSetVolume?: number | null; // Made optional/nullable as per common usage, ensure alignment with strict OpenAPI spec
  e1rmAvg?: number | null;    // Made optional/nullable
};

type MuscleSeries = {
  muscleId: number;
  name: string;
  points: WeekPoint[];
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
  muscles: MuscleSeries[];
  metrics: MetricSeries[];
};
// --- End OpenAPI Response Type Definitions ---

// --- Helper Functions ---
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // Sunday - Saturday : 0 - 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0); // Normalize to start of day
  return d;
}

function getISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDateRangeFromSpan(span: string): { startDate: string, endDate: string } {
  const now = new Date();
  const currentWeekMonday = getWeekStartDate(now);

  const endDateForPeriod = new Date(currentWeekMonday);
  endDateForPeriod.setDate(endDateForPeriod.getDate() + 6); // End of current week (Sunday)

  let weeksToSubtract = 1; // Default to 1w
  const spanMatch = /(\d+)w/.exec(span);
  if (spanMatch?.[1]) {
    weeksToSubtract = Number.parseInt(spanMatch[1], 10);
  }

  const startDateForPeriod = new Date(currentWeekMonday);
  // To get a span of N weeks *including* the current week,
  // we go back N-1 weeks from the start of the current week.
  startDateForPeriod.setDate(startDateForPeriod.getDate() - (weeksToSubtract - 1) * 7);

  return {
    startDate: getISODateString(startDateForPeriod),
    endDate: getISODateString(endDateForPeriod), // This will be the end of the current week
  };
}

function getPreviousWeekStartDateString(currentWeekStartStr: string): string {
  const currentWeekStartDate = new Date(currentWeekStartStr);
  const previousWeekStartDate = new Date(currentWeekStartDate);
  previousWeekStartDate.setDate(previousWeekStartDate.getDate() - 7);
  return getISODateString(previousWeekStartDate);
}

// --- End Helper Functions ---

// --- Mapping Function DTO to OpenAPI Response ---
function toWeekPoint(volumeDto?: WeeklyUserVolumeDto | null): WeekPoint | null {
  if (!volumeDto) return null;
  return {
    weekStart: volumeDto.weekStart,
    totalVolume: volumeDto.totalVolume,
    avgSetVolume: volumeDto.avgSetVolume, // DTO has number, OpenAPI allows null
    e1rmAvg: volumeDto.e1rmAvg,
  };
}

function mapDtoToResponse(
  dto: DashboardDataDto,
  userIdInput: string,
  requestedSpan: string
): DashboardResponse {
  const currentIsoWeekStartDate = getISODateString(getWeekStartDate(new Date()));

  // thisWeek
  const thisWeekData = dto.currentWeekSummary?.volumeStats;
  const thisWeek: WeekPoint = toWeekPoint(thisWeekData) ?? {
    weekStart: currentIsoWeekStartDate,
    totalVolume: 0,
    avgSetVolume: 0,
    e1rmAvg: null,
  };

  // lastWeek
  const lastWeekStartDateStr = getPreviousWeekStartDateString(thisWeek.weekStart);
  const lastWeekDtoFromHistorical = (dto.historicalWeeklyVolumes ?? []).find(
    (v) => v.weekStart === lastWeekStartDateStr
  );
  const lastWeek: WeekPoint = toWeekPoint(lastWeekDtoFromHistorical) ?? {
    weekStart: lastWeekStartDateStr,
    totalVolume: 0,
    avgSetVolume: 0,
    e1rmAvg: null,
  };

  // trend - Includes all historical data points, should align with the requested span.
  // The DTO's historicalWeeklyVolumes should already be filtered by the span via the query handler.
  const trend: WeekPoint[] = (dto.historicalWeeklyVolumes ?? [])
    .map(toWeekPoint)
    .filter((wp): wp is WeekPoint => wp !== null) // Type guard to filter out nulls
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());

  // muscles
  const musclesData: { [muscleId: number]: { name?: string, points: WeekPoint[] } } = {};
  for (const mVol of (dto.historicalWeeklyMuscleVolumes ?? [])) {
    if (!musclesData[mVol.muscleId]) {
      musclesData[mVol.muscleId] = { name: mVol.muscleName, points: [] };
    }
    // For MuscleSeries, WeekPoint's avgSetVolume & e1rmAvg might not be directly available from WeeklyUserMuscleVolumeDto.
    // Using 0/null as placeholders, as per earlier discussion.
    musclesData[mVol.muscleId].points.push({
      weekStart: mVol.weekStart,
      totalVolume: mVol.volume,
      avgSetVolume: 0, // Placeholder
      e1rmAvg: null,   // Placeholder
    });
  }
  const muscles: MuscleSeries[] = Object.entries(musclesData).map(([id, data]) => ({
    muscleId: Number.parseInt(id, 10),
    name: data.name ?? 'Unknown Muscle',
    points: data.points.sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()),
  }));

  // metrics
  const metricsData: { [key: string]: { unit?: string | null, points: MetricPoint[] } } = {};
  for (const metric of (dto.historicalMetrics ?? [])) {
    if (!metricsData[metric.metricKey]) {
      metricsData[metric.metricKey] = { unit: metric.metricUnit, points: [] };
    }
    metricsData[metric.metricKey].points.push({
      weekStart: metric.weekStart,
      value: metric.metricValue,
    });
  }
  const metrics: MetricSeries[] = Object.entries(metricsData).map(([key, data]) => ({
    metricKey: key,
    unit: data.unit ?? '',
    points: data.points.sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()),
  }));

  return {
    userId: userIdInput,
    span: requestedSpan,
    thisWeek,
    lastWeek,
    trend,
    muscles,
    metrics,
  };
}
// --- End Mapping Function ---

dashboardStatsApp.get('/', /* authenticate, */ async (c) => { // authenticate will be applied in router.ts
  try {
    // userId should be populated by jwtAuthMiddleware in router.ts via jwtPayload
    const jwtTokenPayload = c.var.jwtPayload; 
    const userId = jwtTokenPayload?.sub || 'test-user-id-fallback'; 
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // 'period' または 'span' クエリパラメータを取得し、それに基づいて日付範囲を計算
    const periodOrSpanQuery = c.req.query('period') || c.req.query('span');
    const requestedSpan = periodOrSpanQuery || '1w'; // APIレスポンスで使用するspan

    let queryStartDate = c.req.query('startDate');
    let queryEndDate = c.req.query('endDate');

    if (periodOrSpanQuery && (!queryStartDate || !queryEndDate)) {
      // period/span が指定されていて、かつ startDate/endDate が直接指定されていない場合、日付範囲を計算
      const range = calculateDateRangeFromSpan(periodOrSpanQuery);
      queryStartDate = range.startDate;
      queryEndDate = range.endDate;
    }
    
    const { metricKeys: metricKeysQuery } = c.req.query();
    let metricKeys: string[] | undefined;
    if (typeof metricKeysQuery === 'string' && metricKeysQuery.trim() !== '') {
      metricKeys = metricKeysQuery.split(',').map(k => k.trim()).filter(k => k !== '');
    } else if (Array.isArray(metricKeysQuery)) { 
        metricKeys = metricKeysQuery.map(k => k.trim()).filter(k => k !== '');
        if (metricKeys.length === 0) metricKeys = undefined;
    }

    const query = new GetDashboardDataQuery(userId, queryStartDate, queryEndDate, metricKeys);
    
    // dashboardQueryHandler should be populated by DI middleware in router.ts
    // The type for c.var.dashboardQueryHandler will come from AppEnv in router.ts.
    const handler = c.var.dashboardQueryHandler;

    if (!handler) {
        console.error("Dashboard query handler not initialized. This should be set by upstream middleware.");
        return c.json({ error: "Internal server error: Handler not available." }, 500);
    }
    
    const dashboardDto: DashboardDataDto = await handler.execute(query);

    // Map DTO to the OpenAPI response structure
    const responsePayload: DashboardResponse = mapDtoToResponse(dashboardDto, userId, requestedSpan);

    return c.json(responsePayload);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    if (error instanceof Error) {
        return c.json({ error: 'Failed to fetch dashboard statistics', details: error.message }, 500);
    }
    return c.json({ error: 'Failed to fetch dashboard statistics' }, 500);
  }
});

export default dashboardStatsApp;
