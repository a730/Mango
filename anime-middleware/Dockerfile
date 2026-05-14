FROM node:22-alpine

RUN adduser -D nodeuser
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

USER nodeuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3456/api/health > /dev/null || exit 1

EXPOSE 3456

CMD ["node", "server.js"]
