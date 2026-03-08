const http = require("http");
const fs = require("fs");
const querystring = require("querystring");
const path = require("path");
const crypto = require("crypto");

// 用于存储验证码（key: sessionId, value: 加密后的验证码答案）
let captchaStore = {};
let verifyStore = {};
const MAX_CAPTCHA_STORE_SIZE = 10000;
const MAX_VERIFY_STORE_SIZE = 50000;

// 生成加密密钥
const ENCRYPTION_KEY = crypto.randomBytes(32);
const ENCRYPTION_IV = crypto.randomBytes(16);

function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, ENCRYPTION_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, ENCRYPTION_IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 速率限制
const rateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 100;

function generateCaptchaCode() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars[crypto.randomInt(0, chars.length)];
    }
    return code;
}

// 点阵字体
const dotMatrixFont = {
    '0': [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
    '1': [[0, 1, 0], [1, 1, 0], [0, 1, 0], [0, 1, 0], [1, 1, 1]],
    '2': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 0], [1, 1, 1]],
    '3': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    '4': [[1, 0, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [0, 0, 1]],
    '5': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    '6': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
    '7': [[1, 1, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
    '8': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
    '9': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    'A': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 0, 1]],
    'B': [[1, 1, 0], [1, 0, 1], [1, 1, 0], [1, 0, 1], [1, 1, 0]],
    'C': [[1, 1, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 1, 1]],
    'D': [[1, 1, 0], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 0]],
    'E': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1]],
    'F': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 0], [1, 0, 0]],
    'G': [[1, 1, 1], [1, 0, 0], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
    'H': [[1, 0, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 0, 1]],
    'J': [[1, 1, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [1, 1, 1]],
    'K': [[1, 0, 1], [1, 0, 1], [1, 1, 0], [1, 0, 1], [1, 0, 1]],
    'L': [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 1, 1]],
    'M': [[1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1]],
    'N': [[1, 0, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 0, 1]],
    'P': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 0], [1, 0, 0]],
    'Q': [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1]],
    'R': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 0, 1]],
    'S': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    'T': [[1, 1, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
    'U': [[1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
    'V': [[1, 0, 1], [1, 0, 1], [1, 0, 1], [0, 1, 0], [0, 1, 0]],
    'W': [[1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1]],
    'X': [[1, 0, 1], [1, 0, 1], [0, 1, 0], [1, 0, 1], [1, 0, 1]],
    'Y': [[1, 0, 1], [1, 0, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
    'Z': [[1, 1, 1], [0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1]]
};

function generateCaptchaSVG(captchaCode) {
    const width = 140, height = 50, dotSize = 4, padding = 10;
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${width}" height="${height}" fill="#f8f8f8"/>`;

    for (let i = 0; i < 80; i++) {
        const x = (crypto.randomInt(0, 10000) / 10000) * width;
        const y = (crypto.randomInt(0, 10000) / 10000) * height;
        const r = (crypto.randomInt(0, 2000) / 1000);
        const gray = crypto.randomInt(180, 240);
        svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgb(${gray},${gray},${gray})"/>`;
    }

    const charWidth = (width - padding * 2) / captchaCode.length;
    for (let i = 0; i < captchaCode.length; i++) {
        const char = captchaCode[i];
        const matrix = dotMatrixFont[char];
        if (!matrix) continue;

        const baseX = padding + i * charWidth + charWidth / 2 - 15;
        const baseY = height / 2 - 10;
        const rotate = ((crypto.randomInt(0, 10000) / 10000) - 0.5) * 20;
        const gray = crypto.randomInt(20, 100);

        svg += `<g transform="translate(${baseX}, ${baseY}) rotate(${rotate})">`;
        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] === 1) {
                    const offsetX = ((crypto.randomInt(0, 10000) / 10000) - 0.5) * 2;
                    const offsetY = ((crypto.randomInt(0, 10000) / 10000) - 0.5) * 2;
                    svg += `<rect x="${col * dotSize + offsetX}" y="${row * dotSize + offsetY}" width="${dotSize - 1}" height="${dotSize - 1}" fill="rgb(${gray},${gray},${gray})"/>`;
                }
            }
        }
        svg += `</g>`;
    }
    svg += `</svg>`;
    return svg;
}

function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(32).toString("hex");
    return crypto.createHash('sha256').update(timestamp + random).digest('hex');
}

function generateUID() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(32).toString("hex");
    return crypto.createHash('sha256').update(timestamp + random).digest('hex');
}

function checkRateLimit(key) {
    const now = Date.now();
    if (!rateLimitStore[key]) {
        rateLimitStore[key] = { requests: [], lastReset: now, blockUntil: 0, blockCount: 0 };
    }

    if (rateLimitStore[key].blockUntil > now) return false;

    rateLimitStore[key].requests = rateLimitStore[key].requests.filter(t => now - t < RATE_LIMIT_WINDOW);

    if (rateLimitStore[key].requests.length >= MAX_REQUESTS_PER_WINDOW) {
        const blockDuration = Math.min(300000, rateLimitStore[key].blockCount * 60000 + 60000);
        rateLimitStore[key].blockUntil = now + blockDuration;
        rateLimitStore[key].blockCount++;
        return false;
    }

    rateLimitStore[key].requests.push(now);
    return true;
}

function checkSessionRateLimit(sessionId) {
    const now = Date.now();
    const key = `session_${sessionId}`;
    if (!rateLimitStore[key]) {
        rateLimitStore[key] = { requests: [], lastReset: now, blockUntil: 0, blockCount: 0 };
    }

    if (rateLimitStore[key].blockUntil > now) return false;

    rateLimitStore[key].requests = rateLimitStore[key].requests.filter(t => now - t < 30000);

    if (rateLimitStore[key].requests.length >= 5) {
        const blockDuration = Math.min(300000, rateLimitStore[key].blockCount * 30000 + 30000);
        rateLimitStore[key].blockUntil = now + blockDuration;
        rateLimitStore[key].blockCount++;
        return false;
    }

    rateLimitStore[key].requests.push(now);
    return true;
}

function serveStaticFile(req, res) {
    const urlPath = req.url;
    const cleanPath = urlPath.split('?')[0].split('#')[0];
    const safePath = path.normalize(cleanPath).replace(/^\.+/, "").replace(/^\//, "");
    const staticPath = path.join(__dirname, "public", safePath);
    const publicDir = path.resolve(__dirname, "public");

    if (!staticPath.startsWith(publicDir)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "访问被拒绝" }));
    }

    const allowedExts = [".css", ".js", ".html", ".png", ".jpg", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot"];
    const ext = path.extname(staticPath).toLowerCase();

    if (!allowedExts.includes(ext)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "访问被拒绝" }));
    }

    fs.access(staticPath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, message: "文件不存在" }));
        }

        fs.stat(staticPath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: false, message: "文件不存在" }));
            }

            const contentTypes = {
                ".css": "text/css",
                ".js": "application/javascript",
                ".html": "text/html; charset=utf-8",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
                ".ttf": "font/ttf",
                ".eot": "application/vnd.ms-fontobject"
            };

            res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
            res.setHeader("Cache-Control", "public, max-age=3600");

            const stream = fs.createReadStream(staticPath);
            stream.pipe(res);
            stream.on("error", (err) => {
                console.error(`[${new Date().toISOString()}] 静态文件读取失败 - ${staticPath}:`, err.message);
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ success: false, message: "服务器错误" }));
                }
            });
        });
    });
}

const server = http.createServer((req, res) => {
    let clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (clientIp && clientIp.startsWith("::ffff:")) {
        clientIp = clientIp.substring(7);
    }

    const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"];
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        return res.end();
    }

    const isStaticFile = /\.(css|js|png|jpg|svg|ico|woff|woff2|ttf|eot)$/i.test(req.url);

    if (!isStaticFile && !checkRateLimit(clientIp)) {
        res.writeHead(429, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "请求过于频繁，请稍后再试" }));
    }

    if (isStaticFile) {
        return serveStaticFile(req, res);
    }

    const MAX_BODY_SIZE = 1024 * 10;
    let bodySize = 0;

    req.on("data", (chunk) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_SIZE) {
            res.writeHead(413);
            res.end(JSON.stringify({ success: false, message: "请求体过大" }));
            req.destroy();
        }
    });

    // 根路径返回首页
    if (req.url === "/" && req.method === "GET") {
        const htmlPath = path.join(__dirname, "index.html");
        fs.readFile(htmlPath, "utf8", (err, data) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] 读取首页失败:`, err.message);
                res.writeHead(500);
                return res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
            const sessionId = generateSessionId();
            const cookieOptions = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
            res.setHeader("Set-Cookie", `sessionId=${sessionId}; Path=/; HttpOnly; ${cookieOptions}SameSite=Strict`);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(data);
        });
        return;
    }

    // 获取验证码
    else if (req.url === "/get-captcha" && req.method === "GET") {
        const cookies = querystring.parse(req.headers.cookie || "", "; ");
        const sessionId = cookies.sessionId;

        if (!sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, message: "未获取到会话ID" }));
        }

        const captchaCode = generateCaptchaCode();
        const captchaSVG = generateCaptchaSVG(captchaCode);

        if (Object.keys(captchaStore).length >= MAX_CAPTCHA_STORE_SIZE) {
            delete captchaStore[Object.keys(captchaStore)[0]];
        }

        captchaStore[sessionId] = {
            code: encrypt(captchaCode),
            timestamp: Date.now()
        };

        setTimeout(() => delete captchaStore[sessionId], 5 * 60 * 1000);

        res.setHeader("Content-Type", "image/svg+xml");
        res.end(captchaSVG);
        return;
    }

    // 验证验证码
    else if (req.url === "/verify" && req.method === "POST") {
        let postData = "";
        req.on("data", (chunk) => postData += chunk);
        req.on("end", () => {
            try {
                const formData = querystring.parse(postData);
                const userCode = formData.userCode?.toUpperCase();
                const detectionData = formData.detection ? JSON.parse(formData.detection) : null;
                const cookies = querystring.parse(req.headers.cookie || "", "; ");
                const sessionId = cookies.sessionId;

                if (!userCode || !sessionId) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: "参数缺失或会话失效" }));
                }

                if (detectionData) {
                    if (detectionData.hasUserScript) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ success: false, message: "检测到用户脚本插件，验证失败" }));
                    }

                    if (!detectionData.token || detectionData.token.length < 20) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ success: false, message: "检测信息无效，验证失败" }));
                    }

                    const now = Date.now();
                    if (Math.abs(now - detectionData.timestamp) > 300000) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ success: false, message: "检测信息已过期，验证失败" }));
                    }
                }

                if (!checkSessionRateLimit(sessionId)) {
                    res.writeHead(429, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: "验证尝试过于频繁，请稍后再试" }));
                }

                if (!/^[A-Z0-9]{4}$/.test(userCode)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: "验证码格式错误" }));
                }

                const storedData = captchaStore[sessionId];
                if (!storedData || !storedData.code) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: "验证码已过期，请刷新" }));
                }

                const correctCode = decrypt(storedData.code);

                if (userCode === correctCode) {
                    const uid = generateUID();

                    if (Object.keys(verifyStore).length >= MAX_VERIFY_STORE_SIZE) {
                        delete verifyStore[Object.keys(verifyStore)[0]];
                    }

                    verifyStore[uid] = { verified: true, timestamp: Date.now() };
                    setTimeout(() => delete verifyStore[uid], 24 * 60 * 60 * 1000);
                    delete captchaStore[sessionId];

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true, message: "验证成功", uid: uid }));
                } else {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, message: "验证码错误" }));
                }
            } catch (error) {
                console.error(`[${new Date().toISOString()}] 验证过程出错:`, error.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
        });
        return;
    }

    // 查询验证状态
    else if (req.url.startsWith("/inquire") && req.method === "GET") {
        try {
            const uid = new URL(req.url, `http://${req.headers.host}`).searchParams.get("uid");

            if (!uid || !/^[a-f0-9]{64}$/.test(uid)) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(false));
            }

            const queryRateLimitKey = `query_${clientIp}`;
            if (!checkRateLimit(queryRateLimitKey)) {
                res.writeHead(429, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(false));
            }

            const verifyData = verifyStore[uid];
            const isVerified = verifyData && verifyData.verified === true && (Date.now() - verifyData.timestamp < 24 * 60 * 60 * 1000);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(isVerified));
        } catch (error) {
            console.error(`[${new Date().toISOString()}] 查询验证状态出错:`, error.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify(false));
        }
        return;
    }

    // 404
    else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "未找到" }));
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] 服务器已启动，监听端口 ${PORT}`);
    console.log(`  - http://127.0.0.1:${PORT}`);
    console.log(`  - http://[::1]:${PORT}`);
    console.log(`  - http://localhost:${PORT}`);
});

// 定期清理
setInterval(() => {
    const now = Date.now();

    Object.keys(rateLimitStore).forEach(key => {
        if (now - rateLimitStore[key].lastReset > RATE_LIMIT_WINDOW * 2) {
            delete rateLimitStore[key];
        }
    });

    Object.keys(captchaStore).forEach(sessionId => {
        if (captchaStore[sessionId] && (now - captchaStore[sessionId].timestamp > 5 * 60 * 1000)) {
            delete captchaStore[sessionId];
        }
    });

    Object.keys(verifyStore).forEach(uid => {
        if (verifyStore[uid] && (now - verifyStore[uid].timestamp > 24 * 60 * 60 * 1000)) {
            delete verifyStore[uid];
        }
    });
}, 5 * 60 * 1000);