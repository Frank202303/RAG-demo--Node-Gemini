import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { askRAG } from "./rag.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ ok: true, service: "ask-api", ask: "POST /ask with JSON body { \"question\": \"...\" }" });
});

app.post("/ask", async (req, res) => {
    const { question } = req.body;

    if (question === undefined || question === null || String(question).trim() === "") {
        return res.status(400).json({
            error: '缺少 question：请用 JSON body，例如 { "question": "What is RAG?" }，并设置 Header Content-Type: application/json'
        });
    }

    try {
        const answer = await askRAG(question);
        res.json({ answer });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err?.message || "Internal error",
            hint: "查看 Cloud Run「日志」中的 stderr；确认已配置 GOOGLE_CLOUD_PROJECT、Vertex AI 权限与模型名。"
        });
    }
});

const PORT = process.env.PORT || 3000;
// Cloud Run 会设置 PORT；容器内需监听 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});