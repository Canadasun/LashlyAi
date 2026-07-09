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
import { errorHandler, requestLogger } from "./middleware/errorHandler";
import { localStorageDir } from "./services/storage.service";
import { logger } from "./utils/logger";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(helmet());
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
