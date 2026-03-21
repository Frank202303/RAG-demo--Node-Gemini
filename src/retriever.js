// 面试可以说：

// I implemented a simple fixed-size chunking strategy to break documents into manageable pieces.
// 我实施了一种简单的固定大小分块策略，将文档拆分成易于管理的小块。

export function splitIntoChunks(text, chunkSize = 220) {
    // Prefer paragraph chunks first; they preserve meaning better than fixed slicing.
    const paragraphs = text
        .split(/\n\s*\n/g)
        .map((p) => p.trim())
        .filter(Boolean);

    if (paragraphs.length > 0) {
        return paragraphs;
    }

    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

// 关键词匹配（baseline）
// I used a simple keyword-based scoring mechanism as a baseline retriever before introducing embeddings.
//  在引入词嵌入之前，我使用了一种简单的基于关键词的评分机制作为基线检索器。
export function retrieveRelevantChunks(chunks, question) {
    const STOP_WORDS = new Set([
        "what",
        "is",
        "are",
        "the",
        "a",
        "an",
        "of",
        "to",
        "in",
        "for",
        "on",
        "and",
        "with"
    ]);

    const normalizeWords = (text) =>
        text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ") // “去标点/去非字母数字字符”。原问题：What is RAG?  去标点后：what is rag

            .split(/\s+/)
            .filter((w) => w && !STOP_WORDS.has(w));  // 过滤停用词： 停用词是信息量很低、几乎每句都有的词，比如：what, is, the, a, an, of。

    const queryWords = normalizeWords(question);

    const scored = chunks.map((chunk) => {
        let score = 0;
        const chunkText = chunk.toLowerCase();

        queryWords.forEach((word) => {
            if (chunkText.includes(word)) {
                score++;
            }
        });

        return { chunk, score };
    });

    // 排序取最相关的
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 2);
    const hasPositiveScore = top.some((item) => item.score > 0);

    // If nothing matches after cleanup, still provide at least one chunk.
    return (hasPositiveScore ? top : scored.slice(0, 1)).map((c) => c.chunk);
}