import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { connectDB, eventsCol, joinsCol } from "./db";
import eventsRouter from "./routes/events";
import joinsRouter from "./routes/joins";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowed = (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((s) => s.trim().replace(/\/$/, ""));
app.use(cors({ origin: allowed }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ name: "Shomaj API", status: "running" });
});

// Small public numbers shown on the home page hero.
app.get("/api/stats", async (req, res, next) => {
  try {
    const [upcomingEvents, volunteers] = await Promise.all([
      eventsCol().countDocuments({ eventDate: { $gt: new Date() } }),
      joinsCol().countDocuments(),
    ]);
    res.json({ upcomingEvents, volunteers });
  } catch (err) {
    next(err);
  }
});

app.use("/api/events", eventsRouter);
app.use("/api/joins", joinsRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

// Express only reaches this when something threw or a rejected promise was
// forwarded by asyncHandler. Always answer with JSON, never a stack trace.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Malformed JSON body -> 400 rather than a generic 500.
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return res.status(400).json({ message: "Request body is not valid JSON." });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Shomaj API listening on port ${PORT}`)))
  .catch((err: unknown) => {
    console.error("Failed to start server:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
