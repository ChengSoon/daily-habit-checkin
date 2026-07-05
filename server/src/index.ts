import cors from "cors";
import "dotenv/config";
import express from "express";
import { generateHabitPlan } from "./openaiHabitPlanner.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/ai/habit-plan", async (request, response) => {
  try {
    const plan = await generateHabitPlan(request.body);
    response.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(400).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Habit AI server listening on http://localhost:${port}`);
});
