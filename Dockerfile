# Cloud Run：监听 $PORT（默认 8080）
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.js"]
