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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});