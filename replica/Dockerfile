FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY replica ./replica

WORKDIR /app/replica

EXPOSE 5001 5002 5003

CMD ["npx", "nodemon", "--legacy-watch", "--ext", "js,json", "server.js"]
