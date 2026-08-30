import { z } from "zod";
import type { Tool } from "@tagent/core";

// ============================================================
// get_weather：城市天气查询（本地 mock 数据，FR-6①）
//
// 数据是假的，但协议是真的：AC-5 要求"查无此城"时返回明确错误数据，
// 让模型学会向用户如实说明或换参数——mock 边界正是错误回填的练兵场
// ============================================================

interface WeatherRecord {
  condition: string;
  tempC: number;
  humidity: number;
  aqi: number;
}

const WEATHER_DB: Record<string, WeatherRecord> = {
  北京: { condition: "晴", tempC: 28, humidity: 40, aqi: 55 },
  上海: { condition: "多云", tempC: 31, humidity: 70, aqi: 48 },
  广州: { condition: "雷阵雨", tempC: 33, humidity: 85, aqi: 62 },
  深圳: { condition: "阵雨", tempC: 32, humidity: 80, aqi: 35 },
  杭州: { condition: "晴转多云", tempC: 30, humidity: 65, aqi: 58 },
};

export const weatherTool: Tool<z.ZodObject<{ city: z.ZodString }>> = {
  name: "get_weather",
  description: "查询指定城市的当前天气（支持：北京/上海/广州/深圳/杭州）",
  schema: z.object({
    city: z.string().min(1).describe("城市名，如：北京"),
  }),
  execute: async (args) => {
    const hit = WEATHER_DB[args.city];
    if (!hit) {
      // 注意：返回"数据里说明失败"，而不是抛异常——
      // 让模型读到结构化的错误原因与可用城市列表，自行决定怎么向用户解释
      return {
        ok: false,
        error: `no weather data for city: ${args.city}`,
        availableCities: Object.keys(WEATHER_DB),
      };
    }
    return {
      ok: true,
      city: args.city,
      ...hit,
      fetchedAt: new Date().toISOString(),
      source: "mock",
    };
  },
};
