// 面试可以说：

// I implemented a simple fixed-size chunking strategy to break documents into manageable pieces.
// 我实施了一种简单的固定大小分块策略，将文档拆分成易于管理的小块。

export function splitIntoChunks(text, chunkSize = 100) {
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
    const scored = chunks.map((chunk) => {
        let score = 0;
        const words = question.toLowerCase().split(" ");

        words.forEach((word) => {
            if (chunk.toLowerCase().includes(word)) {
                score++;
            }
        });

        return { chunk, score };
    });

    // 排序取最相关的
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 2).map((c) => c.chunk);
}