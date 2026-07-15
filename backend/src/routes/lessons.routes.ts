import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import {
  getAllLessons,
  getCompletedLessonIds,
  getLessonById,
  Lesson,
  markLessonComplete,
} from "../models/Lesson";
import { ENFORCEMENT_ENABLED, getUserPlan } from "../services/planLimits.service";
import { asyncHandler } from "../utils/asyncHandler";

export const lessonsRouter = Router();

// Matches the promised paywall copy: "5 beginner lessons" free, full curriculum on
// Pro. order_index is 1-based and seeded 1-10 (see migration 0007_lessons.sql), and
// the first 5 already are the beginner fundamentals (basics, anatomy, health &
// safety, tools, isolation) — lessons 6-10 are more applied technique content.
const FREE_LESSON_LIMIT = 5;

function isLessonLocked(lesson: Lesson, plan: string): boolean {
  return ENFORCEMENT_ENABLED && plan === "free" && lesson.order_index > FREE_LESSON_LIMIT;
}

lessonsRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const [lessons, completedIds, plan] = await Promise.all([
      getAllLessons(),
      getCompletedLessonIds(req.currentUser!.id),
      getUserPlan(req.currentUser!.id),
    ]);
    res.json(
      lessons.map((lesson) => {
        const locked = isLessonLocked(lesson, plan);
        return {
          ...lesson,
          // Never send the full lesson body for a locked lesson — title/summary
          // still show as a teaser (standard freemium list UX), matching how the
          // detail route below also refuses to serve locked content.
          content: locked ? null : lesson.content,
          completed: completedIds.has(lesson.id),
          locked,
        };
      }),
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
    const plan = await getUserPlan(req.currentUser!.id);
    if (isLessonLocked(lesson, plan)) {
      res.status(403).json({
        error: "This lesson is a Pro feature. Upgrade to Pro to unlock all 10 lessons.",
      });
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
    const plan = await getUserPlan(req.currentUser!.id);
    if (isLessonLocked(lesson, plan)) {
      res.status(403).json({
        error: "This lesson is a Pro feature. Upgrade to Pro to unlock all 10 lessons.",
      });
      return;
    }
    await markLessonComplete(req.currentUser!.id, lesson.id);
    res.status(204).send();
  }),
);
