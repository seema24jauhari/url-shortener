FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g pm2

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["pm2-runtime", "dist/main.js", "-i", "max"]