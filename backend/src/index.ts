import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "lashlyai-backend", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`LashlyAI backend listening on port ${port}`);
});
