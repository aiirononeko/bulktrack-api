import { Hono } from "hono";
import type { Variables, WorkerEnv } from "../../types/env";
import {
  deleteSet,
  getTrainingSets,
  recordTrainingSet,
  updateSet,
} from "./handlers";

export const setRoutes = new Hono<{
  Bindings: WorkerEnv;
  Variables: Variables;
}>();

// POST /sets - Record a new set
setRoutes.post("/", recordTrainingSet);

// GET /sets - Get user's sets
setRoutes.get("/", getTrainingSets);

// PATCH /sets/:setId - Update a set
setRoutes.patch("/:setId", updateSet);

// DELETE /sets/:setId - Delete a set
setRoutes.delete("/:setId", deleteSet);
