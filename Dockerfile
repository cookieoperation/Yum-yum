FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV MEDIA_PATH=/media/place/photo
ENV PORT=4025

EXPOSE 4025
CMD ["node", "server.js"]
