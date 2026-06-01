FROM node:20-slim

WORKDIR /app

# Add your OS packages here
RUN apt-get update && apt-get install -y \
    curl \
    nano \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js .

EXPOSE 3000

CMD ["npm", "start"]
