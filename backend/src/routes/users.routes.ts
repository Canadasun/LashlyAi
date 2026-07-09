import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { asyncHandler } from "../utils/asyncHandler";

export const usersRouter = Router();

usersRouter.get(
  "/me",
  requireUser,
  asyncHandler(async (req, res) => {
    res.json(req.currentUser);
  }),
);
