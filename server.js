const express = require('express');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
const port = process.env.PORT || 3000;

const TOR_SOCKS = process.env.TOR_SOCKS || 'socks5h://127.0.0.1:9050';
const I2P_SOCKS = process.env.I2P_SOCKS || 'socks5h://127.0.0.1:4447';

const torAgent = new SocksProxyAgent(TOR_SOCKS);
const i2pAgent = new SocksProxyAgent(I2P_SOCKS);

const WEB3_GATEWAY = process.env.WEB3_GATEWAY || 'https://eth.limo';

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
            return res.status(403).json({ 
                error: "Forbidden. Only .onion, .i2p, and Web3 domains are permitted." 
            });
        }

        const response = await axios({
            method: 'GET',
            url: finalUrl,
            responseType: 'stream',
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 60000      
        });

        // 3. Forward the target's headers to the client
        Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        // Pipe the response stream to the client
        response.data.pipe(res);

    } catch (error) {
        console.error(`[Error] Failed to connect to ${website}:`, error.message);
        res.status(502).json({ error: "Bad Gateway", details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Daemon Proxy listening on port ${port}`);
    console.log(`Tor Routing -> ${TOR_SOCKS}`);
    console.log(`I2P Routing -> ${I2P_SOCKS}`);
});
