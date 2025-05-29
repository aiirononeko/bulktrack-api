import { Hono } from "hono";
import type { Variables, WorkerEnv } from "../../types/env";
import { getTrainingSets, recordTrainingSet } from "./handlers";

export const trainingSetRoutes = new Hono<{
  Bindings: WorkerEnv;
  Variables: Variables;
}>();

// POST /training-sets - Record a new training set
trainingSetRoutes.post("/", recordTrainingSet);

// GET /training-sets - Get user's training sets
trainingSetRoutes.get("/", getTrainingSets);
