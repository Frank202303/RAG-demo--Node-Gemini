// rag-fetch.js
import fetch from "node-fetch"; // 确保已经 npm install node-fetch
import { loadDocuments } from "./loader.js";
import { splitIntoChunks, retrieveRelevantChunks } from "./retriever.js";

/**
 * 使用 Google Generative AI API + RAG 流程回答问题
 * @param {string} question
 * @returns {Promise<string>}
 */
export async function askRAG(question) {
    // 1️⃣ Load 文档
    const text = await loadDocuments();

    // 2️⃣ 切分成 chunks
    const chunks = splitIntoChunks(text);

    // 3️⃣ 检索相关 chunks
    const relevantChunks = retrieveRelevantChunks(chunks, question);

    // 4️⃣ 拼接上下文
    const context = relevantChunks.join("\n");

    const prompt = `
You are an AI assistant. Use the context below to answer the question.

Context:
${context}

Question:
${question}

Answer:
`;

    // 5️⃣ 调用 Google Generative AI API
    const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await res.json();

    // 6️⃣ 返回生成的文本
    return data?.candidates?.[0]?.content?.[0]?.text ?? "No answer";
}