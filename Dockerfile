FROM node:22-slim
WORKDIR /app
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD="true"
RUN npm install --production
RUN apt-get update && apt-get install -y curl bash ca-certificates unzip && \
    curl -fsSL https://antigravity.google/cli/install.sh | bash && \
    rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
