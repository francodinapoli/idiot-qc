FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY data/defaultProducts.json ./data/defaultProducts.json
COPY docker ./docker
COPY public ./public
COPY server ./server
COPY scripts ./scripts

EXPOSE 3000

CMD ["node", "server/index.js"]
