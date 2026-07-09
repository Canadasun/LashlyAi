import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";
import { localStorageDir } from "./services/storage.service";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "lashlyai-backend", timestamp: new Date().toISOString() });
});

// Dev-only: serves images written by the local-disk storage stub. Swap for a real
// S3 bucket + CDN before production.
app.use("/local-storage", express.static(localStorageDir()));

app.use("/auth", authRouter);
app.use("/users", usersRouter);

app.listen(port, () => {
  console.log(`LashlyAI backend listening on port ${port}`);
});
