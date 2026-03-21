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

    if (!res.ok) {
        const errMsg = data?.error?.message || `Gemini API error: ${res.status}`;
        throw new Error(errMsg);
    }
    //     问题已经定位并修好，主要有两个点：
    // Gemini 返回文本的解析路径写错了。你原来用的是 content[0].text，但实际结构是 content.parts[0].text，所以一直走到了 "No answer"。
    // 本机当时还有旧的 node src/index.js 进程在跑，导致你请求到的可能是旧代码版本。重启后才生效。
    // 我修改了 src/rag.js：
    // 把返回解析改为 data?.candidates?.[0]?.content?.parts?.[0]?.text
    // 增加了 res.ok 检查，Gemini 非 2xx 时会抛出明确错误信息，避免“静默失败”
    // 现在我本地复测你的请求：
    // POST http://localhost:3000/ask
    // body:
    // {  "question": "What is BigQuery?"}
    // 返回已正确：
    // {"answer":"BigQuery is a data warehouse solution for analytics."}
    // 如果你愿意，我可以顺手再帮你加一个小的 health 接口和请求日志，后面排查这类问题会更快。

    // 6️⃣ 返回生成的文本
    console.log("数据:", data)
    // Gemini 返回结构是 content.parts[].text，而不是 content[0].text
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No answer";
}