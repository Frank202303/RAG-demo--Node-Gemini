import fs from "fs";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadDocuments } from "./loader.js";
import { splitIntoChunks, retrieveRelevantChunks } from "./retriever.js";

/** 仅当显式设置了 JSON 路径时检查文件存在（Cloud Run 通常不设此变量，靠服务账号 ADC） */
function assertVertexCredentialsFileIfSet() {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!p) return;
    if (!fs.existsSync(p)) {
        throw new Error(
            `找不到凭证文件：${p}\n请把 GOOGLE_APPLICATION_CREDENTIALS 改成你本机服务账号 JSON 的**真实路径**（文档里的 C:\\path\\to\\key.json 只是示例，不能直接照抄）。`
        );
    }
}

/** 从 Vertex / Gemini 响应里取出第一段文本 */
function extractTextFromResponse(response) {
    const part = response?.candidates?.[0]?.content?.parts?.[0];
    return part?.text ?? null;
}

/**
 * - Cloud Run：默认走 Vertex（K_SERVICE 存在 + GOOGLE_CLOUD_PROJECT）。
 * - 本地：若 .env 里有 GEMINI_API_KEY / GOOGLE_API_KEY，**优先走 AI Studio**，
 *   即使你 Shell 里还设了 GOOGLE_CLOUD_PROJECT（避免 Vertex 模型/区域 404 把本地卡死）。
 * - 本地强制 Vertex：USE_VERTEX_AI=true，且不要依赖 API Key；或从环境里去掉 GOOGLE_API_KEY。
 */
export async function askRAG(question) {
    const text = await loadDocuments();
    const chunks = splitIntoChunks(text);
    const relevantChunks = retrieveRelevantChunks(chunks, question);
    const context = relevantChunks.join("\n");

    const prompt = `
You are an AI assistant. Use the context below to answer the question.

Context:
${context}

Question:
${question}

Answer:
`.trim();

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    // Vertex「API 区域」≠ Cloud Run 部署区域。部分项目在 locations/global 上对 Publisher 模型会长期 404；
    // 默认改用 us-central1（与 @google-cloud/vertexai 默认一致），更常见可用。
    // 若要用 global：设 GOOGLE_CLOUD_LOCATION=global（代码会配 apiEndpoint: aiplatform.googleapis.com）。
    const location =
        process.env.GEMINI_VERTEX_LOCATION ||
        process.env.GOOGLE_CLOUD_LOCATION ||
        "us-central1";
    const apiKey =
        process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    const forceApiKey = process.env.USE_GEMINI_API_KEY === "true";
    const forceVertex = process.env.USE_VERTEX_AI === "true";
    const onCloudRun = Boolean(process.env.K_SERVICE);

    /** 是否走 Vertex：Cloud Run 或显式 USE_VERTEX_AI；本地同时有 API Key 时默认不走 Vertex */
    const useVertex = (() => {
        if (forceApiKey) return false;
        if (!projectId) return false;
        if (!apiKey) return true;
        if (onCloudRun || forceVertex) return true;
        return false;
    })();

    // Vertex：用当前文档中的稳定模型 ID（见 model-versions）。2.0-flash-001 在部分账号/global 下会 404。
    // AI Studio（API Key）仍可用短名 gemini-2.0-flash。
    const modelId =
        process.env.GEMINI_MODEL ||
        (useVertex ? "gemini-2.5-flash-lite" : "gemini-2.0-flash");

    if (useVertex) {
        assertVertexCredentialsFileIfSet();
        // location=global 时，SDK 默认会请求 global-aiplatform.googleapis.com（无效，返回 HTML → JSON 解析报错）。
        // 官方 global 端点主机为 aiplatform.googleapis.com，见：
        // https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
        const vertexInit =
            location === "global"
                ? {
                      project: projectId,
                      location: "global",
                      apiEndpoint: "aiplatform.googleapis.com"
                  }
                : { project: projectId, location };
        const vertex = new VertexAI(vertexInit);
        const model = vertex.getGenerativeModel({ model: modelId });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        const textOut = extractTextFromResponse(result.response);
        if (!textOut) {
            throw new Error(
                "Vertex AI returned empty response. Check model name and IAM (Vertex AI User)."
            );
        }
        return textOut;
    }

    if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelId });
        const result = await model.generateContent(prompt);
        const textOut =
            typeof result.response.text === "function"
                ? result.response.text()
                : extractTextFromResponse(result.response);
        if (!textOut) {
            throw new Error(
                "Gemini (API key) returned empty response. Check GEMINI_API_KEY and model name."
            );
        }
        return textOut;
    }

    throw new Error(
        "未配置鉴权：本地可在 .env 设置 GOOGLE_API_KEY；Vertex 需 GOOGLE_CLOUD_PROJECT + ADC，Cloud Run 上可设 USE_VERTEX_AI=true。"
    );
}
