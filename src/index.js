import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { askRAG } from "./rag.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ask", async (req, res) => {
    const { question } = req.body;

    try {
        const answer = await askRAG(question);
        res.json({ answer });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
});

const PORT = process.env.PORT || 3000;
// Cloud Run 会设置 PORT；容器内需监听 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});