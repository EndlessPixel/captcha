const http = require("http");
const fs = require("fs");
const querystring = require("querystring");
const path = require("path");
const crypto = require("crypto");

// 用于存储验证码（key: sessionId, value: 加密后的验证码答案）
// 生产环境建议用Redis，并设置过期时间
let captchaStore = {};
let verifyStore = {};
const MAX_CAPTCHA_STORE_SIZE = 10000; // 验证码存储最大容量
const MAX_VERIFY_STORE_SIZE = 50000; // 验证状态存储最大容量

// 生成加密密钥
const ENCRYPTION_KEY = crypto.randomBytes(32);
const ENCRYPTION_IV = crypto.randomBytes(16);

// 加密函数
function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, ENCRYPTION_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// 解密函数
function decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, ENCRYPTION_IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 速率限制存储
const rateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const MAX_REQUESTS_PER_WINDOW = 100; // 每分钟最多100个请求

// 生成随机验证码（4位数字+大写字母）
function generateCaptchaCode() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        // 使用加密安全的随机数生成器
        const randomIndex = crypto.randomInt(0, chars.length);
        code += chars[randomIndex];
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
        // 使用加密安全的随机数生成器
        const x = (crypto.randomInt(0, 10000) / 10000) * width;
        const y = (crypto.randomInt(0, 10000) / 10000) * height;
        const r = (crypto.randomInt(0, 2000) / 1000);
        const gray = crypto.randomInt(180, 240);
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
        // 使用加密安全的随机数生成器
        const rotate = ((crypto.randomInt(0, 10000) / 10000) - 0.5) * 20;
        const gray = crypto.randomInt(20, 100);
        
        // 为每个字符添加旋转效果
        svg += `<g transform="translate(${baseX}, ${baseY}) rotate(${rotate})">`;
        
        // 绘制点阵字符
        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] === 1) {
                    // 使用加密安全的随机数生成器
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

// 生成唯一SessionID（模拟用户会话）
function generateSessionId() {
    // 结合时间戳和随机字节，增强唯一性
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash('sha256').update(timestamp + random).digest('hex');
    return hash;
}

// 生成安全的UID
function generateUID() {
    // 结合时间戳和随机字节，增强唯一性
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash('sha256').update(timestamp + random).digest('hex');
    return hash;
}

// 检查速率限制
function checkRateLimit(key) {
    const now = Date.now();
    if (!rateLimitStore[key]) {
        rateLimitStore[key] = {
            requests: [],
            lastReset: now,
            blockUntil: 0, // 封禁截止时间
            blockCount: 0
        };
    }
    
    // 检查是否在封禁期内
    if (rateLimitStore[key].blockUntil > now) {
        return false;
    }
    
    // 清理过期的请求
    rateLimitStore[key].requests = rateLimitStore[key].requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    // 检查是否超过限制
    if (rateLimitStore[key].requests.length >= MAX_REQUESTS_PER_WINDOW) {
        // 触发封禁，封禁时间随次数递增
        const blockDuration = Math.min(300000, rateLimitStore[key].blockCount * 60000 + 60000); // 最小1分钟，最大5分钟
        rateLimitStore[key].blockUntil = now + blockDuration;
        rateLimitStore[key].blockCount += 1;
        return false;
    }
    
    // 记录新请求
    rateLimitStore[key].requests.push(now);
    return true;
}

// 检查session验证速率限制
function checkSessionRateLimit(sessionId) {
    const now = Date.now();
    const key = `session_${sessionId}`;
    if (!rateLimitStore[key]) {
        rateLimitStore[key] = {
            requests: [],
            lastReset: now,
            blockUntil: 0,
            blockCount: 0
        };
    }
    
    // 检查是否在封禁期内
    if (rateLimitStore[key].blockUntil > now) {
        return false;
    }
    
    // 清理过期的请求（30秒窗口）
    rateLimitStore[key].requests = rateLimitStore[key].requests.filter(timestamp => now - timestamp < 30000);
    
    // 限制单sessionId在30秒内最多5次验证尝试
    if (rateLimitStore[key].requests.length >= 5) {
        // 触发封禁，封禁时间随次数递增
        const blockDuration = Math.min(300000, rateLimitStore[key].blockCount * 30000 + 30000); // 最小30秒，最大5分钟
        rateLimitStore[key].blockUntil = now + blockDuration;
        rateLimitStore[key].blockCount += 1;
        return false;
    }
    
    // 记录新请求
    rateLimitStore[key].requests.push(now);
    return true;
}

// 静态文件服务
function serveStaticFile(req, res) {
    // 防止路径遍历攻击
    const urlPath = req.url;
    // 移除查询参数
    const cleanPath = urlPath.split('?')[0].split('#')[0];
    // 规范化路径
    const safePath = path.normalize(cleanPath).replace(/^\.+/, "");
    // 构建绝对路径
    const staticPath = path.resolve(__dirname, "public", safePath);
    const publicDir = path.resolve(__dirname, "public");
    
    // 确保路径在public目录内
    if (!staticPath.startsWith(publicDir)) {
        return res.writeHead(403), void res.end(JSON.stringify({ success: false, message: "访问被拒绝" }));
    }
    
    // 允许的文件扩展名
    const allowedExts = [".css", ".js", ".html", ".png", ".jpg", ".svg"];
    const ext = path.extname(staticPath);
    if (!allowedExts.includes(ext)) {
        return res.writeHead(403), void res.end(JSON.stringify({ success: false, message: "访问被拒绝" }));
    }
    
    fs.access(staticPath, fs.constants.F_OK, (err) => {
        if (err) return res.writeHead(404), void res.end(JSON.stringify(false));
        
        // 检查是否是文件
        fs.stat(staticPath, (err, stats) => {
            if (err || !stats.isFile()) {
                return res.writeHead(404), void res.end(JSON.stringify(false));
            }
            
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
            stream.on("error", (err) => {
                console.error(`[${new Date().toISOString()}] 静态文件读取失败 - ${staticPath}:`, err.message, err.stack);
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
    const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");

    // 限制请求体大小
    const MAX_BODY_SIZE = 1024 * 10; // 限制10KB
    let bodySize = 0;
    
    req.on("data", (chunk) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_SIZE) {
            res.writeHead(413);
            res.end(JSON.stringify({ success: false, message: "请求体过大" }));
            req.destroy();
        }
    });
    
    // 清理事件监听器
    req.on("end", () => {
        // 请求结束，清理相关状态
    });

    // 1. 根路径返回首页
    if (req.url === "/" && req.method === "GET") {
        const htmlPath = path.join(__dirname, "index.html");
        fs.readFile(htmlPath, "utf8", (err, data) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] 读取首页失败 - ${req.url}:`, err.message, err.stack);
                return res.writeHead(500), void res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
            // 生成SessionID并设置Cookie（模拟用户会话）
            const sessionId = generateSessionId();
            // 生产环境中应设置Secure标志
            const cookieOptions = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
            res.setHeader("Set-Cookie", `sessionId=${sessionId}; Path=/; HttpOnly; ${cookieOptions}SameSite=Strict`);
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
        
        // 检查验证码存储容量
        if (Object.keys(captchaStore).length >= MAX_CAPTCHA_STORE_SIZE) {
            // 清理最旧的验证码（简化实现，实际生产环境建议使用Redis等存储）
            const oldestKey = Object.keys(captchaStore)[0];
            delete captchaStore[oldestKey];
        }
        
        // 加密存储验证码到服务端（关联sessionId）
        const encryptedCode = encrypt(captchaCode);
        captchaStore[sessionId] = {
            code: encryptedCode,
            timestamp: Date.now()
        };
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
                const detectionData = formData.detection ? JSON.parse(formData.detection) : null;
                // 从Cookie获取sessionId
                const cookies = querystring.parse(req.headers.cookie || "", "; ");
                const sessionId = cookies.sessionId;

                // 校验参数
                if (!userCode || !sessionId) {
                    return res.end(JSON.stringify({ success: false, message: "参数缺失或会话失效" }));
                }

                // 验证前端检测结果
                if (detectionData) {
                    // 检查前端是否检测到用户脚本插件
                    if (detectionData.hasUserScript) {
                        return res.end(JSON.stringify({ success: false, message: "检测到用户脚本插件，验证失败" }));
                    }
                    
                    // 检查检测令牌是否有效（简单验证，实际生产环境可使用更复杂的验证）
                    if (!detectionData.token || detectionData.token.length < 20) {
                        return res.end(JSON.stringify({ success: false, message: "检测信息无效，验证失败" }));
                    }
                    
                    // 检查时间戳是否有效（防止重放攻击）
                    const now = Date.now();
                    if (Math.abs(now - detectionData.timestamp) > 300000) { // 5分钟内有效
                        return res.end(JSON.stringify({ success: false, message: "检测信息已过期，验证失败" }));
                    }
                }

                // 检查session验证速率限制
                if (!checkSessionRateLimit(sessionId)) {
                    return res.end(JSON.stringify({ success: false, message: "验证尝试过于频繁，请稍后再试" }));
                }

                // 验证用户输入格式
                if (!/^[A-Z0-9]{4}$/.test(userCode)) {
                    return res.end(JSON.stringify({ success: false, message: "验证码格式错误" }));
                }

                // 从服务端获取正确验证码
                const storedData = captchaStore[sessionId];
                if (!storedData || !storedData.code) {
                    return res.end(JSON.stringify({ success: false, message: "验证码已过期，请刷新" }));
                }

                // 解密验证码
                const correctCode = decrypt(storedData.code);

                // 对比验证码（后端独立验证）
                if (userCode === correctCode) {
                    const uid = generateUID();
                    
                    // 检查验证状态存储容量
                    if (Object.keys(verifyStore).length >= MAX_VERIFY_STORE_SIZE) {
                        // 清理最旧的验证状态
                        const oldestKey = Object.keys(verifyStore)[0];
                        delete verifyStore[oldestKey];
                    }
                    
                    verifyStore[uid] = {
                        verified: true,
                        timestamp: Date.now()
                    };
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
                console.error(`[${new Date().toISOString()}] 验证过程出错 - ${req.url}:`, error.message, error.stack);
                res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
        });
    }

    // 4. 查询验证状态接口
    else if (req.url.startsWith("/inquire") && req.method === "GET") {
        try {
            const uid = new URL(req.url, `http://${req.headers.host}`).searchParams.get("uid");
            
            // 验证UID格式
            if (!uid || !/^[a-f0-9]{64}$/.test(uid)) {
                return void res.end(JSON.stringify(false));
            }
            
            // 为查询接口添加额外的速率限制
            const queryRateLimitKey = `query_${clientIp}`;
            if (!checkRateLimit(queryRateLimitKey)) {
                return void res.end(JSON.stringify(false));
            }
            
            // 检查验证状态是否存在且未过期
            const verifyData = verifyStore[uid];
            const isVerified = verifyData && verifyData.verified === true && (Date.now() - verifyData.timestamp < 24 * 60 * 60 * 1000);
            res.end(JSON.stringify(isVerified));
        } catch (error) {
            console.error(`[${new Date().toISOString()}] 查询验证状态出错 - ${req.url}:`, error.message, error.stack);
            res.end(JSON.stringify(false));
        }
    }
        // 使用 http(s)://{ip/domain}(:{port})/inquire?uid={uid} 查询用户验证状态，可接入任何脚本网页或者机器人框架使用

    // 5. API版本接口
    else if (req.url.startsWith("/api/captcha") && req.method === "GET") {
        try {
            // 生成API专用的token
            const apiToken = generateUID();
            
            // 后端生成验证码
            const captchaCode = generateCaptchaCode();
            // 生成SVG格式的验证码图片
            const captchaSVG = generateCaptchaSVG(captchaCode);
            
            // 检查验证码存储容量
            if (Object.keys(captchaStore).length >= MAX_CAPTCHA_STORE_SIZE) {
                // 清理最旧的验证码
                const oldestKey = Object.keys(captchaStore)[0];
                delete captchaStore[oldestKey];
            }
            
            // 加密存储验证码到服务端（关联apiToken）
            const encryptedCode = encrypt(captchaCode);
            captchaStore[apiToken] = {
                code: encryptedCode,
                timestamp: Date.now(),
                isApi: true
            };
            // 设置验证码过期（5分钟）
            setTimeout(() => {
                delete captchaStore[apiToken];
            }, 5 * 60 * 1000);

            // 返回API格式的响应
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
                success: true,
                token: apiToken,
                captcha: `data:image/svg+xml;base64,${Buffer.from(captchaSVG).toString('base64')}`
            }));
        } catch (error) {
            console.error(`[${new Date().toISOString()}] API获取验证码出错 - ${req.url}:`, error.message, error.stack);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, message: "服务器错误" }));
        }
    }
    
    // 6. API验证接口
    else if (req.url === "/api/verify" && req.method === "POST") {
        let postData = "";
        req.on("data", (chunk) => postData += chunk);
        req.on("end", () => {
            try {
                const formData = querystring.parse(postData);
                const userCode = formData.userCode?.toUpperCase();
                const apiToken = formData.token;

                // 校验参数
                if (!userCode || !apiToken) {
                    return res.end(JSON.stringify({ success: false, message: "参数缺失" }));
                }

                // 检查API验证速率限制
                if (!checkSessionRateLimit(`api_${apiToken}`)) {
                    return res.end(JSON.stringify({ success: false, message: "验证尝试过于频繁，请稍后再试" }));
                }

                // 验证用户输入格式
                if (!/^[A-Z0-9]{4}$/.test(userCode)) {
                    return res.end(JSON.stringify({ success: false, message: "验证码格式错误" }));
                }

                // 从服务端获取正确验证码
                const storedData = captchaStore[apiToken];
                if (!storedData || !storedData.code) {
                    return res.end(JSON.stringify({ success: false, message: "验证码已过期，请刷新" }));
                }

                // 解密验证码
                const correctCode = decrypt(storedData.code);

                // 对比验证码（后端独立验证）
                if (userCode === correctCode) {
                    const uid = generateUID();
                    
                    // 检查验证状态存储容量
                    if (Object.keys(verifyStore).length >= MAX_VERIFY_STORE_SIZE) {
                        // 清理最旧的验证状态
                        const oldestKey = Object.keys(verifyStore)[0];
                        delete verifyStore[oldestKey];
                    }
                    
                    verifyStore[uid] = {
                        verified: true,
                        timestamp: Date.now()
                    };
                    // 设置UID过期（24小时）
                    setTimeout(() => {
                        delete verifyStore[uid];
                    }, 24 * 60 * 60 * 1000);
                    // 验证成功后删除验证码，防止重复使用
                    delete captchaStore[apiToken];
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true, message: "验证成功", uid: uid }));
                } else {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: false, message: "验证码错误" }));
                }
            } catch (error) {
                console.error(`[${new Date().toISOString()}] API验证过程出错 - ${req.url}:`, error.message, error.stack);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, message: "服务器错误" }));
            }
        });
    }
    
    // 7. API查询验证状态接口
    else if (req.url.startsWith("/api/inquire") && req.method === "GET") {
        try {
            const uid = new URL(req.url, `http://${req.headers.host}`).searchParams.get("uid");
            
            // 验证UID格式
            if (!uid || !/^[a-f0-9]{64}$/.test(uid)) {
                return void res.end(JSON.stringify({ success: false, message: "无效的UID" }));
            }
            
            // 为查询接口添加额外的速率限制
            const queryRateLimitKey = `api_query_${clientIp}`;
            if (!checkRateLimit(queryRateLimitKey)) {
                return void res.end(JSON.stringify({ success: false, message: "查询过于频繁，请稍后再试" }));
            }
            
            // 检查验证状态是否存在且未过期
            const verifyData = verifyStore[uid];
            const isVerified = verifyData && verifyData.verified === true && (Date.now() - verifyData.timestamp < 24 * 60 * 60 * 1000);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, verified: isVerified }));
        } catch (error) {
            console.error(`[${new Date().toISOString()}] API查询验证状态出错 - ${req.url}:`, error.message, error.stack);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, message: "服务器错误" }));
        }
    }

    // 静态文件
    else {
        serveStaticFile(req, res);
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] 服务器已启动，监听端口 ${PORT}\nIPV4: http://127.0.0.1:${PORT}\nPIV6: http://[::1]:${PORT}\ndomain: http://localhost:${PORT}`);
});

// 定期清理过期数据
setInterval(() => {
    const now = Date.now();
    // 清理rateLimitStore
    Object.keys(rateLimitStore).forEach(key => {
        if (now - rateLimitStore[key].lastReset > RATE_LIMIT_WINDOW * 2) {
            delete rateLimitStore[key];
        }
    });
    
    // 清理过期的验证码
    Object.keys(captchaStore).forEach(sessionId => {
        const storedData = captchaStore[sessionId];
        if (storedData && (now - storedData.timestamp > 5 * 60 * 1000)) {
            delete captchaStore[sessionId];
        }
    });
    
    // 清理过期的验证状态
    Object.keys(verifyStore).forEach(uid => {
        const verifyData = verifyStore[uid];
        if (verifyData && (now - verifyData.timestamp > 24 * 60 * 60 * 1000)) {
            delete verifyStore[uid];
        }
    });
}, 5 * 60 * 1000);
