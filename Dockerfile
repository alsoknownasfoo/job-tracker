FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
RUN apk add --no-cache curl bash && \
    curl -fsSL https://antigravity.google/cli/install.sh | bash
ENV PATH="/root/.local/bin:${PATH}"
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
