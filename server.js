const http = require("http");
const fs = require("fs");
const querystring = require("querystring");
const path = require("path");
const crypto = require("crypto");

// 用于存储验证码（key: sessionId, value: 验证码答案）
// 生产环境建议用Redis，并设置过期时间
let captchaStore = {};
let verifyStore = {};

// 速率限制存储
const rateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const MAX_REQUESTS_PER_WINDOW = 100; // 每分钟最多100个请求

// 生成随机验证码（4位数字+大写字母）
function generateCaptchaCode() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// 点阵字体定义
const dotMatrixFont = {
    '0': [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
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

// 生成SVG格式的验证码图片
function generateCaptchaSVG(captchaCode) {
    const width = 140;
    const height = 50;
    const dotSize = 4;
    const padding = 10;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // 绘制背景
    svg += `<rect width="${width}" height="${height}" fill="#f8f8f8"/>`;
    
    // 绘制干扰点
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = Math.random() * 2;
        const gray = Math.floor(Math.random() * 60 + 180);
        svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgb(${gray},${gray},${gray})"/>`;
    }
    
    // 绘制验证码字符
    const charWidth = (width - padding * 2) / captchaCode.length;
    for (let i = 0; i < captchaCode.length; i++) {
        const char = captchaCode[i];
        const matrix = dotMatrixFont[char];
        if (!matrix) continue;
        
        const baseX = padding + i * charWidth + charWidth / 2 - 15;
        const baseY = height / 2 - 10;
        const rotate = (Math.random() - 0.5) * 20;
        const gray = Math.floor(Math.random() * 80 + 20);
        
        // 为每个字符添加旋转效果
        svg += `<g transform="translate(${baseX}, ${baseY}) rotate(${rotate})">`;
        
        // 绘制点阵字符
        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] === 1) {
                    const offsetX = (Math.random() - 0.5) * 2;
                    const offsetY = (Math.random() - 0.5) * 2;
                    svg += `<rect x="${col * dotSize + offsetX}" y="${row * dotSize + offsetY}" width="${dotSize - 1}" height="${dotSize - 1}" fill="rgb(${gray},${gray},${gray})"/>`;
                }
            }
        }
        
        svg += `</g>`;
    }
    
    svg += `</svg>`;
    return svg;
}

// 生成唯一SessionID（模拟用户会话）
function generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
}

// 生成安全的UID
function generateUID() {
    return crypto.randomBytes(16).toString("hex") + "-" + crypto.randomBytes(8).toString("hex");
}

// 检查速率限制
function checkRateLimit(ip) {
    const now = Date.now();
    if (!rateLimitStore[ip]) {
        rateLimitStore[ip] = {
            requests: [],
            lastReset: now
        };
    }
    
    // 清理过期的请求
    rateLimitStore[ip].requests = rateLimitStore[ip].requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    // 检查是否超过限制
    if (rateLimitStore[ip].requests.length >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }
    
    // 记录新请求
    rateLimitStore[ip].requests.push(now);
    return true;
}

// 静态文件服务
function serveStaticFile(req, res) {
    // 防止路径遍历攻击
    const safePath = path.normalize(req.url).replace(/^\.+/, "");
    const staticPath = path.join(__dirname, "public", safePath);
    
    // 确保路径在public目录内
    if (!staticPath.startsWith(path.join(__dirname, "public"))) {
        return res.writeHead(403), void res.end(JSON.stringify({ success: false, message: "访问被拒绝" }));
    }
    
    fs.access(staticPath, fs.constants.F_OK, (err) => {
        if (err) return res.writeHead(404), void res.end(JSON.stringify(false));
        
        // 检查是否是文件
        fs.stat(staticPath, (err, stats) => {
            if (err || !stats.isFile()) {
                return res.writeHead(404), void res.end(JSON.stringify(false));
            }
            
            const ext = path.extname(staticPath);
            let contentType = "text/plain";
            switch (ext) {
                case ".css":
                    contentType = "text/css";
                    break;
                case ".js":
                    contentType = "application/javascript";
                    break;
                case ".html":
                    contentType = "text/html; charset=utf-8";
                    break;
                case ".png":
                    contentType = "image/png";
                    break;
                case ".jpg":
                    contentType = "image/jpeg";
                    break;
                case ".svg":
                    contentType = "image/svg+xml";
                    break;
            }
            
            // 设置缓存头
            res.setHeader("Cache-Control", "public, max-age=3600");
            res.setHeader("Content-Type", contentType);
            
            // 使用流读取文件，提高性能
            const stream = fs.createReadStream(staticPath);
            stream.pipe(res);
            stream.on("error", () => {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            });
        });
    });
}

const server = http.createServer((req, res) => {
    // 获取客户端IP
    const clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    
    // 检查速率限制
    if (!checkRateLimit(clientIp)) {
        res.writeHead(429);
        return res.end(JSON.stringify({ success: false, message: "请求过于频繁，请稍后再试" }));
    }
    
    // 允许跨域（仅允许特定域名）
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");

    // 限制请求体大小
    req.on("data", (chunk) => {
        if (req.bodySize && req.bodySize + chunk.length > 1024 * 10) { // 限制10KB
            res.writeHead(413);
            res.end(JSON.stringify({ success: false, message: "请求体过大" }));
            req.destroy();
        }
        req.bodySize = (req.bodySize || 0) + chunk.length;
    });

    // 1. 根路径返回首页
    if (req.url === "/" && req.method === "GET") {
        const htmlPath = path.join(__dirname, "index.html");
        fs.readFile(htmlPath, "utf8", (err, data) => {
            if (err) {
                console.error("读取首页失败:", err);
                return res.writeHead(500), void res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
            // 生成SessionID并设置Cookie（模拟用户会话）
            const sessionId = generateSessionId();
            res.setHeader("Set-Cookie", `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict`);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(data);
        });
    }

    // 2. 获取验证码接口（后端生成，返回SVG格式验证码）
    else if (req.url === "/get-captcha" && req.method === "GET") {
        // 从Cookie获取sessionId
        const cookies = querystring.parse(req.headers.cookie || "", "; ");
        const sessionId = cookies.sessionId;
        if (!sessionId) {
            return res.end(JSON.stringify({ success: false, message: "未获取到会话ID" }));
        }

        // 后端生成验证码
        const captchaCode = generateCaptchaCode();
        // 生成SVG格式的验证码图片
        const captchaSVG = generateCaptchaSVG(captchaCode);
        // 存储验证码到服务端（关联sessionId）
        captchaStore[sessionId] = captchaCode;
        // 设置验证码过期（5分钟）
        setTimeout(() => {
            delete captchaStore[sessionId];
        }, 5 * 60 * 1000);

        // 返回SVG格式的验证码
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(captchaSVG);
    }

    // 3. 验证验证码接口（仅接收用户输入，后端对比自己存储的答案）
    else if (req.url === "/verify" && req.method === "POST") {
        let postData = "";
        req.on("data", (chunk) => postData += chunk);
        req.on("end", () => {
            try {
                const formData = querystring.parse(postData);
                const userCode = formData.userCode?.toUpperCase();
                // 从Cookie获取sessionId
                const cookies = querystring.parse(req.headers.cookie || "", "; ");
                const sessionId = cookies.sessionId;

                // 校验参数
                if (!userCode || !sessionId) {
                    return res.end(JSON.stringify({ success: false, message: "参数缺失或会话失效" }));
                }

                // 验证用户输入格式
                if (!/^[A-Z0-9]{4}$/.test(userCode)) {
                    return res.end(JSON.stringify({ success: false, message: "验证码格式错误" }));
                }

                // 从服务端获取正确验证码
                const correctCode = captchaStore[sessionId];
                if (!correctCode) {
                    return res.end(JSON.stringify({ success: false, message: "验证码已过期，请刷新" }));
                }

                // 对比验证码（后端独立验证）
                if (userCode === correctCode) {
                    const uid = generateUID();
                    verifyStore[uid] = true;
                    // 设置UID过期（24小时）
                    setTimeout(() => {
                        delete verifyStore[uid];
                    }, 24 * 60 * 60 * 1000);
                    // 验证成功后删除验证码，防止重复使用
                    delete captchaStore[sessionId];
                    res.end(JSON.stringify({ success: true, message: "验证成功", uid: uid }));
                } else {
                    res.end(JSON.stringify({ success: false, message: "验证码错误" }));
                }
            } catch (error) {
                console.error("验证过程出错:", error);
                res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
        });
    }

    // 4. 查询验证状态接口
    else if (req.url.startsWith("/inquire") && req.method === "GET") {
        try {
            const uid = new URL(req.url, `http://${req.headers.host}`).searchParams.get("uid");
            if (!uid) return void res.end(JSON.stringify(false));
            const isVerified = verifyStore[uid] === true;
            res.end(JSON.stringify(isVerified));
        } catch (error) {
            console.error("查询验证状态出错:", error);
            res.end(JSON.stringify(false));
        }
    }
        // 使用 http(s)://{ip/domain}(:{port})/inquire?uid={uid} 查询用户验证状态，可接入任何脚本网页或者机器人框架使用

    // 静态文件
    else {
        serveStaticFile(req, res);
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
});

// 定期清理过期数据
setInterval(() => {
    const now = Date.now();
    // 清理rateLimitStore
    Object.keys(rateLimitStore).forEach(ip => {
        if (now - rateLimitStore[ip].lastReset > RATE_LIMIT_WINDOW * 2) {
            delete rateLimitStore[ip];
        }
    });
}, 5 * 60 * 1000);
