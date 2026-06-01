echo "🚀 Generating Render Proxy Files..."

echo "📦 1/4 Creating package.json..."
cat << 'EOF' > package.json
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
EOF

echo "📜 2/4 Creating server.js (JavaScript)..."
cat << 'EOF' > server.js
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
EOF

echo "🐳 3/4 Creating Dockerfile..."
cat << 'EOF' > Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3000
CMD ["npm", "start"]
EOF

echo "🐙 4/4 Creating render.yaml..."
cat << 'EOF' > render.yaml
services:
  - type: pserv
    name: tor-daemon
    env: docker
    image: osminogin/tor-simple

  - type: pserv
    name: i2pd-daemon
    env: docker
    image: purplei2p/i2pd

  - type: web
    name: daemon-proxy
    env: docker
    plan: free 
    envVars:
      - key: TOR_SOCKS
        value: socks5h://tor-daemon:9050
      - key: I2P_SOCKS
        value: socks5h://i2pd-daemon:4447
EOF

echo "✅ Setup Complete!"
echo "Now push these files to GitHub to trigger your Render deployment:"
echo "  git add ."
echo "  git commit -m 'Auto-install clean setup'"
echo "  git push"
