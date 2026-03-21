import fs from "fs";

export function loadDocuments() {
    const text = fs.readFileSync("./data/knowledge.txt", "utf-8");
    return text;
}