# Bug Zoo Shop: one small container, no npm dependencies.
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    BUGZOO_BUGS=all \
    NODE_OPTIONS=--max-old-space-size=96

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "src/server.js"]
