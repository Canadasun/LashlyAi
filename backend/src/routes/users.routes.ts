import { Router } from "express";
import { requireUser } from "./middleware/requireUser";

export const usersRouter = Router();

usersRouter.get("/me", requireUser, async (req, res) => {
  res.json(req.currentUser);
});
