const http = require("http");
const fs = require("fs");
const querystring = require("querystring");
const path = require("path");
const crypto = require("crypto");

// 用于存储验证码（key: sessionId, value: 验证码答案）
// 生产环境建议用Redis，并设置过期时间
let captchaStore = {};
let verifyStore = {};

// 生成随机验证码（4位数字+大写字母）
function generateCaptchaCode() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// 生成唯一SessionID（模拟用户会话）
function generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
}

// 静态文件服务
function serveStaticFile(req, res) {
    const staticPath = path.join(__dirname, "public", req.url);
    fs.access(staticPath, fs.constants.F_OK, (err) => {
        if (err) return res.writeHead(404), void res.end(JSON.stringify(false));
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
        fs.readFile(staticPath, (err, data) => {
            if (err) return res.writeHead(500), void res.end(JSON.stringify({
                success: false,
                message: "服务器错误"
            }));
            res.setHeader("Content-Type", contentType);
            res.end(data);
        });
    });
}

const server = http.createServer((req, res) => {
    // 允许跨域（可选）
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // 1. 根路径返回首页
    if (req.url === "/" && req.method === "GET") {
        const htmlPath = path.join(__dirname, "index.html");
        fs.readFile(htmlPath, "utf8", (err, data) => {
            if (err) return res.writeHead(500), void res.end(JSON.stringify({
                success: false,
                message: "服务器错误"
            }));
            // 生成SessionID并设置Cookie（模拟用户会话）
            const sessionId = generateSessionId();
            res.setHeader("Set-Cookie", `sessionId=${sessionId}; Path=/; HttpOnly`); // HttpOnly防止前端JS读取
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(data);
        });
    }

    // 2. 获取验证码接口（后端生成，返回验证码内容）
    else if (req.url === "/get-captcha" && req.method === "GET") {
        // 从Cookie获取sessionId
        const cookies = querystring.parse(req.headers.cookie || "", "; ");
        const sessionId = cookies.sessionId;
        if (!sessionId) {
            return res.end(JSON.stringify({ success: false, message: "未获取到会话ID" }));
        }

        // 后端生成验证码
        const captchaCode = generateCaptchaCode();
        // 存储验证码到服务端（关联sessionId）
        captchaStore[sessionId] = captchaCode;
        // 设置验证码过期（5分钟）
        setTimeout(() => {
            delete captchaStore[sessionId];
        }, 5 * 60 * 1000);

        // 返回验证码（前端用于绘制）
        res.end(JSON.stringify({
            success: true,
            captchaCode: captchaCode // 注意：这里返回的是验证码字符，生产环境建议返回图片流
        }));
    }

    // 3. 验证验证码接口（仅接收用户输入，后端对比自己存储的答案）
    else if (req.url === "/verify" && req.method === "POST") {
        let postData = "";
        req.on("data", (chunk) => postData += chunk);
        req.on("end", () => {
            const formData = querystring.parse(postData);
            const userCode = formData.userCode?.toUpperCase();
            // 从Cookie获取sessionId
            const cookies = querystring.parse(req.headers.cookie || "", "; ");
            const sessionId = cookies.sessionId;

            // 校验参数
            if (!userCode || !sessionId) {
                return res.end(JSON.stringify({
                    success: false,
                    message: "参数缺失或会话失效"
                }));
            }

            // 从服务端获取正确验证码
            const correctCode = captchaStore[sessionId];
            if (!correctCode) {
                return res.end(JSON.stringify({
                    success: false,
                    message: "验证码已过期，请刷新"
                }));
            }

            // 对比验证码（后端独立验证）
            if (userCode === correctCode) {
                const uid = generateUID();
                verifyStore[uid] = true;
                // 验证成功后删除验证码，防止重复使用
                delete captchaStore[sessionId];
                res.end(JSON.stringify({
                    success: true,
                    message: "验证成功",
                    uid: uid
                }));
            } else {
                res.end(JSON.stringify({
                    success: false,
                    message: "验证码错误"
                }));
            }
        });
    }

    // 4. 查询验证状态接口
    else if (req.url.startsWith("/inquire") && req.method === "GET") {
        const uid = new URL(req.url, `http://${req.headers.host}`).searchParams.get("uid");
        if (!uid) return void res.end(JSON.stringify(false));
        const isVerified = verifyStore[uid] === true;
        res.end(JSON.stringify(isVerified));
    }

    // 静态文件
    else {
        serveStaticFile(req, res);
    }
});

// 辅助函数：生成UID
function generateUID() {
    return [
        Math.random().toString(16).slice(2, 6).padEnd(4, "0"),
        Math.random().toString(16).slice(2, 6).padEnd(4, "0"),
        Math.random().toString(16).slice(2, 6).padEnd(4, "0"),
        Math.random().toString(16).slice(2, 6).padEnd(4, "0"),
        Math.random().toString(16).slice(2, 10).padEnd(8, "0")
    ].join("-");
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
});