FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
RUN apt-get update && apt-get install -y curl bash ca-certificates && \
    curl -fsSL https://antigravity.google/cli/install.sh | bash && \
    rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
