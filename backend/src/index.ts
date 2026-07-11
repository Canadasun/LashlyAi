import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";
import { clientsRouter } from "./routes/clients.routes";
import { coachRouter } from "./routes/coach.routes";
import { feedbackRouter } from "./routes/feedback.routes";
import { subscriptionsRouter } from "./routes/subscriptions.routes";
import { adminRouter } from "./routes/admin.routes";
import { toolsRouter } from "./routes/tools.routes";
import { inventoryRouter } from "./routes/inventory.routes";
import { marketingRouter } from "./routes/marketing.routes";
import { lessonsRouter } from "./routes/lessons.routes";
import { forumRouter } from "./routes/forum.routes";
import { errorHandler, requestLogger } from "./middleware/errorHandler";
import { localStorageDir } from "./services/storage.service";
import { logger } from "./utils/logger";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Railway sits in front of this app as a single reverse-proxy hop — without this,
// express-rate-limit can't trust X-Forwarded-For to identify the real client IP,
// throwing a ValidationError and potentially rate-limiting everyone as one IP.
app.set("trust proxy", 1);

app.use(helmet());
// Intentionally unrestricted: this API is consumed by the mobile app (no browser
// Origin to check) and auth is a Bearer token in the Authorization header, not a
// cookie — so there's no ambient credential for a CORS restriction to protect against
// the way there would be with cookie-based auth. Revisit if a web frontend with
// cookie-based sessions is ever added.
app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "lashlyai-backend", timestamp: new Date().toISOString() });
});

// Dev-only: serves images written by the local-disk storage stub. Swap for a real
// S3 bucket + CDN before production.
app.use("/local-storage", express.static(localStorageDir()));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/clients", clientsRouter);
app.use("/coach", coachRouter);
app.use("/feedback", feedbackRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/admin", adminRouter);
app.use("/tools", toolsRouter);
app.use("/inventory", inventoryRouter);
app.use("/marketing", marketingRouter);
app.use("/lessons", lessonsRouter);
app.use("/forum", forumRouter);

// Must be registered after all routes.
app.use(errorHandler);

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception — exiting", error);
  process.exit(1);
});

app.listen(port, () => {
  logger.info(`LashlyAI backend listening on port ${port}`);
});
