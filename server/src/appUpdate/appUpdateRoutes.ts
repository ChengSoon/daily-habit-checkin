import { Router } from "express";
import { fetchLatestAppUpdateManifest, ManifestFetch } from "./appUpdateManifest.js";

type AppUpdateRouterOptions = {
  fetcher?: ManifestFetch;
  getManifestUrl?: () => string | undefined;
};

function defaultManifestUrl(): string | undefined {
  return process.env.APP_UPDATE_MANIFEST_URL;
}

export function createAppUpdateRouter(options: AppUpdateRouterOptions = {}): Router {
  const router = Router();
  const getManifestUrl = options.getManifestUrl ?? defaultManifestUrl;

  router.get("/latest", async (request, response) => {
    if (request.query.platform !== "android") {
      response.status(400).json({ error: "暂不支持该平台的应用更新" });
      return;
    }

    try {
      const manifest = await fetchLatestAppUpdateManifest(getManifestUrl(), "android", options.fetcher);
      if (!manifest) {
        response.status(204).send();
        return;
      }
      response.json(manifest);
    } catch {
      response.status(502).json({ error: "更新信息暂不可用" });
    }
  });

  return router;
}
