import express from "express";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Vytor backend is running",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Vytor backend running on port ${PORT}`);
});
