import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import {
  getAllLessons,
  getCompletedLessonIds,
  getLessonById,
  markLessonComplete,
} from "../models/Lesson";
import { asyncHandler } from "../utils/asyncHandler";

export const lessonsRouter = Router();

lessonsRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const [lessons, completedIds] = await Promise.all([
      getAllLessons(),
      getCompletedLessonIds(req.currentUser!.id),
    ]);
    res.json(
      lessons.map((lesson) => ({ ...lesson, completed: completedIds.has(lesson.id) })),
    );
  }),
);

lessonsRouter.get(
  "/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const lesson = await getLessonById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    const completedIds = await getCompletedLessonIds(req.currentUser!.id);
    res.json({ ...lesson, completed: completedIds.has(lesson.id) });
  }),
);

lessonsRouter.post(
  "/:id/complete",
  requireUser,
  asyncHandler(async (req, res) => {
    const lesson = await getLessonById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    await markLessonComplete(req.currentUser!.id, lesson.id);
    res.status(204).send();
  }),
);
