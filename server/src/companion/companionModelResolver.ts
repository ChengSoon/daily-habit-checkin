import {
  createCompanionModel,
  type CompanionModel,
  type CompanionModelOptions
} from "./companionModel.js";
import type { CompanionDb } from "./companionRepository.js";

export const COMPANION_AI_SETTING_KEYS = ["aiBaseUrl", "aiApiKey", "aiModel"] as const;

type SpaceSettingRow = { key: string; value: string };

export type ResolvedCompanionModel = {
  model: CompanionModel;
  source: "space" | "server";
};

export type ResolveCompanionModel = (spaceId: string) => Promise<ResolvedCompanionModel>;

type ModelFactory = (options: CompanionModelOptions) => CompanionModel;

async function defaultDb(): Promise<CompanionDb> {
  const { getPool } = await import("../db/pool.js");
  return getPool() as CompanionDb;
}

function normalizeBaseUrl(value: string): string {
  let url = value.trim().replace(/\/+$/u, "");
  url = url.replace(/\/chat\/completions$/iu, "").replace(/\/+$/u, "");
  if (!/\/v1$/iu.test(url)) {
    const path = url.replace(/^https?:\/\/[^/]+/iu, "");
    if (!path) url = `${url}/v1`;
  }
  return url;
}

function readSettings(rows: SpaceSettingRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value.trim()]));
}

function hasCompleteConfig(settings: Record<string, string>): boolean {
  return COMPANION_AI_SETTING_KEYS.every((key) => Boolean(settings[key]));
}

export function createCompanionModelResolver(options: {
  db?: CompanionDb;
  serverModel?: CompanionModel;
  createModel?: ModelFactory;
} = {}): { resolve: ResolveCompanionModel } {
  const configuredDb = options.db;
  const serverModel = options.serverModel ?? createCompanionModel();
  const createModel = options.createModel ?? ((modelOptions) => createCompanionModel(modelOptions));

  return {
    async resolve(spaceId) {
      const db = configuredDb ?? (await defaultDb());
      const result = await db.query<SpaceSettingRow>(
        `SELECT key, value FROM app_settings
         WHERE space_id = $1 AND key = ANY($2::text[])`,
        [spaceId, [...COMPANION_AI_SETTING_KEYS]]
      );
      const settings = readSettings(result.rows);
      if (!hasCompleteConfig(settings)) return { model: serverModel, source: "server" };

      return {
        model: createModel({
          apiKey: settings.aiApiKey,
          baseUrl: normalizeBaseUrl(settings.aiBaseUrl),
          model: settings.aiModel
        }),
        source: "space"
      };
    }
  };
}

export function createCompanionModelLookup(fixedModel?: CompanionModel): ResolveCompanionModel {
  if (fixedModel) return async () => ({ model: fixedModel, source: "server" });
  return createCompanionModelResolver().resolve;
}
