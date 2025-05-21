# INSIDE /backend
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# EXPOSE 5001
EXPOSE 3000
CMD ["node", "server.js"]