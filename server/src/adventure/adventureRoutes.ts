import { Router } from "express";
import {
  claimAdventureChapter,
  getAdventureState
} from "./adventureService.js";

type ChangeNotifier = (spaceId: string, resource: string) => void;

type AdventureRouterOptions = {
  onChange?: ChangeNotifier;
};

export function createAdventureRouter(options: AdventureRouterOptions = {}): Router {
  const router = Router();

  router.get("/state", async (request, response) => {
    try {
      const state = await getAdventureState(request.spaceId!);
      response.json(state);
    } catch (error) {
      console.error("adventure state failed", error);
      response.status(500).json({ error: "读取闯关进度失败" });
    }
  });

  router.post("/claim", async (request, response) => {
    const chapterId = (request.body as { chapterId?: unknown })?.chapterId;
    if (typeof chapterId !== "string" || chapterId.length === 0) {
      response.status(400).json({ error: "缺少 chapterId" });
      return;
    }

    try {
      const result = await claimAdventureChapter(
        request.spaceId!,
        chapterId,
        request.accountId!
      );
      if (!result.ok) {
        response.status(result.status).json({ error: result.error });
        return;
      }
      options.onChange?.(request.spaceId!, "adventure");
      response.json(result.state);
    } catch (error) {
      console.error("adventure claim failed", error);
      response.status(500).json({ error: "领取章节奖励失败" });
    }
  });

  return router;
}
