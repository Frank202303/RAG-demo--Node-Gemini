# RAG-demo--Node-Gemini

## 运行

```bash
npm install
npm start
```

`POST /ask`，body：`{ "question": "..." }`

## 本地怎么最快跑起来？

在 `.env` 里配置 **`GOOGLE_API_KEY`**（Google AI Studio）和 **`PORT`** 即可，`npm start` 后直接调 `/ask`。  
不必设置 `GOOGLE_CLOUD_PROJECT` / `key.json`，除非你**刻意**要走 Vertex。

若 Shell 里仍设置了 `GOOGLE_CLOUD_PROJECT`，只要 `.env` 里有 API Key，**现在会优先用 AI Studio**，避免 Vertex 模型 404 把本地卡死。

---

## 鉴权：两种模式（二选一）

### A. Vertex AI（推荐：Cloud Run / 生产）

`aiplatform.googleapis.com` **不接受** URL 里的 `?key=`，必须用 **OAuth / 服务账号（ADC）**。

**本地（key.json）：**

1. 在 GCP 控制台创建服务账号，下载 JSON 密钥（例如放到 `C:\Users\你的用户名\keys\ask-ai-sa.json`）。
2. **`C:\path\to\key.json` 只是占位符，必须改成你电脑上的真实路径**，否则会出现 `ENOENT: no such file or directory`。

PowerShell 示例（路径请替换为你的文件）：

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\61415\Documents\Nodejs\AI-Rag\key.json"
$env:GOOGLE_CLOUD_PROJECT="ask-ai-api-2026"
$env:GOOGLE_CLOUD_LOCATION="australia-southeast1"
npm start
```

CMD 示例：

```bat
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\61415\Documents\Nodejs\AI-Rag\key.json
set GOOGLE_CLOUD_PROJECT=ask-ai-api-2026
set GOOGLE_CLOUD_LOCATION=australia-southeast1
npm start
```

> 若 `.env` 里也写了 `GOOGLE_APPLICATION_CREDENTIALS`，以**实际存在文件的路径**为准；错误路径会覆盖你在 PowerShell 里设的变量（取决于 dotenv 与启动顺序）。

**Cloud Run：**

1. 在 Cloud Run 服务里设置环境变量：`GOOGLE_CLOUD_PROJECT`、`GOOGLE_CLOUD_LOCATION`（可选，默认可用 `australia-southeast1`）、`GEMINI_MODEL`（可选）
2. **不要**把 `GOOGLE_APPLICATION_CREDENTIALS` 打进镜像；使用 Cloud Run **默认服务账号**或你指定的服务账号
3. 给该服务账号授予 **`Vertex AI User`**（`roles/aiplatform.user`）

### 部署到 Cloud Run（命令行）

前提：已安装 [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)、已 `gcloud auth login`、项目已开结算并启用 **Vertex AI API**。

在项目根目录执行（按你的项目 ID / 区域改）：

```bash
gcloud config set project ask-ai-api-2026

gcloud run deploy ask-api \
  --source . \
  --region australia-southeast1 \
  --allow-unauthenticated \
  --clear-base-image \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=ask-ai-api-2026,GOOGLE_CLOUD_LOCATION=australia-southeast1,GEMINI_MODEL=gemini-1.5-flash-002"
```

PowerShell（一行）：

```powershell
gcloud run deploy ask-api --source . --region australia-southeast1 --allow-unauthenticated --clear-base-image --set-env-vars "GOOGLE_CLOUD_PROJECT=ask-ai-api-2026,GOOGLE_CLOUD_LOCATION=australia-southeast1,GEMINI_MODEL=gemini-1.5-flash-002"
```

说明：

- 若报错 `Missing required argument [--clear-base-image]`：说明服务曾用过与 Dockerfile 不兼容的「基础镜像」配置，**加上 `--clear-base-image`** 再部署。
- 若 **Build failed**：`gcloud deploy --source` 会按 **`.gitignore`** 打包上传。若曾把 **`package-lock.json` 写进 .gitignore**，上传里没有 lock 文件，`Dockerfile` 里 `COPY package-lock.json` / `npm ci` 会失败。请保证 **`package-lock.json` 不被忽略且存在于项目根目录**，再重新部署；详细日志见 Cloud Build 控制台链接。
- `--source .`：用仓库里的 **Dockerfile** 构建并部署（镜像内**不含** `.env` / `key.json`）。
- Cloud Run 会自动注入 **`K_SERVICE`**，应用会走 **Vertex**；不要把 `GOOGLE_API_KEY` 写进 `--set-env-vars`（易泄露），本地开发再用即可。
- 若某区域模型 404，把 `GOOGLE_CLOUD_LOCATION` 改为 `us-central1` 并调整 `GEMINI_MODEL`（见上文）。
- 部署完成后终端会打印 **服务 URL**，用 Postman `POST https://你的地址/ask`，body：`{"question":"..."}`。

也可用控制台：**Cloud Run → 创建服务 → 从源代码仓库或本地上传**，并同样在「变量」里配置 `GOOGLE_CLOUD_PROJECT` 等。

### B. Google AI Studio API Key（仅本地/测试）

不设 `GOOGLE_CLOUD_PROJECT`，在 `.env` 里设 `GEMINI_API_KEY`（或 `GOOGLE_API_KEY`）。  
若本机同时配置了 GCP 项目变量，想强制走 API Key，可设 `USE_GEMINI_API_KEY=true`。

详见 `.env.example`。

### 本地 Vertex 报 403：`Vertex AI API has not been used` / `SERVICE_DISABLED`

说明当前 GCP 项目**还没启用「Vertex AI API」**（和 key 路径对不对是两回事）。

1. 用浏览器打开（把项目 ID 换成你的）：  
   https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=ask-ai-api-2026  
2. 点击 **启用（Enable）**。  
3. 等待几分钟再重试；若项目未绑结算账号，按控制台提示开通。  
4. 服务账号仍需具备 **Vertex AI User**（`roles/aiplatform.user`）。

**安全提醒**：不要把 `key.json` 提交到 Git；确认 `.gitignore` 已忽略该文件。

### Vertex 报 404：`Publisher Model ... was not found`

说明 **当前 `GOOGLE_CLOUD_LOCATION` 下没有该模型**（区域与模型要匹配）。与 **Google AI Studio** 里的名字也可能不一致。

- 默认模型为 **`gemini-1.5-flash-002`**（在 `australia-southeast1` 一般可用）。
- 若要用 **`gemini-2.0-flash-001`** 等较新模型，常在 **`us-central1`** 才可用，可设：  
  `GOOGLE_CLOUD_LOCATION=us-central1` + `GEMINI_MODEL=gemini-2.0-flash-001`。
- 查可用性：[Vertex 模型与区域](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions)。

---

一键杀所有 Node（慎用）：`taskkill /IM node.exe /F`