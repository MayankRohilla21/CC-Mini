FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY gateway ./gateway

WORKDIR /app/gateway

EXPOSE 8080 8081

CMD ["npx", "nodemon", "--legacy-watch", "--ext", "js,json", "server.js"]
