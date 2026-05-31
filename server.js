mkdir -p daemon-proxy && cd daemon-proxy && cat << 'EOF' > install.sh && bash install.sh
#!/bin/bash

echo "🚀 Starting Daemon Proxy Auto-Install..."

echo "📦 1/4 Writing package.json..."
cat << 'INNER_EOF' > package.json
{
  "name": "daemon-proxy",
  "version": "1.0.0",
  "description": "Proxy gateway for Tor, I2P, and Web3 domains",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.6.8",
    "express": "^4.19.2",
    "socks-proxy-agent": "^8.0.3"
  }
}
INNER_EOF

echo "📜 2/4 Writing server.js..."
cat << 'INNER_EOF' > server.js
const express = require('express');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
const port = process.env.PORT || 3000;

const TOR_SOCKS = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';
const I2P_SOCKS = process.env.I2P_SOCKS || 'socks5h://127.0.0.1:4447';
const WEB3_GATEWAY = process.env.WEB3_GATEWAY || 'https://eth.limo';

const torAgent = new SocksProxyAgent(TOR_SOCKS);
const i2pAgent = new SocksProxyAgent(I2P_SOCKS);

app.get('/connectto/:website(*)', async (req, res) => {
    let website = req.params.website;
    if (!website.startsWith('http://') && !website.startsWith('https://')) {
        website = `http://${website}`;
    }

    try {
        const urlObj = new URL(website);
        const hostname = urlObj.hostname;
        
        let agent = null;
        let finalUrl = website;

        if (hostname.endsWith('.onion')) {
            agent = torAgent;
        } else if (hostname.endsWith('.i2p')) {
            agent = i2pAgent;
        } else if (hostname.match(/\.(eth|crypto|zil|nft)$/)) {
            finalUrl = `${WEB3_GATEWAY}${urlObj.pathname}${urlObj.search}`;
            req.headers['Host'] = hostname; 
        } else {
            return res.status(403).json({ error: "Forbidden. Only .onion, .i2p, and Web3 domains are permitted." });
        }

        const response = await axios({
            method: 'GET',
            url: finalUrl,
            responseType: 'stream',
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 20000 
        });

        Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        response.data.pipe(res);

    } catch (error) {
        console.error(`[Error] Failed to connect to ${website}:`, error.message);
        res.status(502).json({ error: "Bad Gateway", details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Daemon Proxy listening on port ${port}`);
});
INNER_EOF

echo "🐳 3/4 Writing Dockerfile..."
cat << 'INNER_EOF' > Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3000
CMD ["npm", "start"]
INNER_EOF

echo "🐙 4/4 Writing docker-compose.yml..."
cat << 'INNER_EOF' > docker-compose.yml
version: '3.8'

services:
  proxy-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - TOR_SOCKS=socks5h:
      - I2P_SOCKS=socks5h:
    depends_on:
      - tor-daemon
      - i2pd-daemon
    restart: unless-stopped

  tor-daemon:
    image: osminogin/tor-simple
    expose:
      - "9050"
    restart: unless-stopped

  i2pd-daemon:
    image: purplei2p/i2pd
    expose:
      - "4447"
    restart: unless-stopped
INNER_EOF

echo "⚙️ Building and starting Docker containers in the background..."
docker compose up -d --build || docker-compose up -d --build

echo "✅ Setup Complete!"
echo "🌐 Your proxy is now live."
echo "Test a connection using: curl http://localhost:3000/connectto/https://duckduckgogg42xjoc72x3sjtuxvtuxvtuxvtuxvtuxvtux.onion"
EOF
