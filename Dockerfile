FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
RUN apk add --no-cache curl bash && \
    curl -sL https://antigravity.google/install.sh | bash || true
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
