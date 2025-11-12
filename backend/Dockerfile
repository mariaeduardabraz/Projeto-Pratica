FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm","start"]


