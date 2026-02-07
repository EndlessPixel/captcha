const http = require("http"),
    fs = require("fs"),
    querystring = require("querystring"),
    path = require("path");
let verifyStore = {};

function generateUID() {
    return [Math.random().toString(16).slice(2, 6).padEnd(4, "0"), Math.random().toString(16).slice(2, 6).padEnd(4, "0"), Math.random().toString(16).slice(2, 6).padEnd(4, "0"), Math.random().toString(16).slice(2, 6).padEnd(4, "0"), Math.random().toString(16).slice(2, 10).padEnd(8, "0")].join("-")
}

function serveStaticFile(req, res) {
    const staticPath = path.join(__dirname, "public", req.url);
    fs.access(staticPath, fs.constants.F_OK, err => {
        if (err) return res.writeHead(404), void res.end(JSON.stringify(!1));
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
                contentType = "image/svg+xml"
        }
        fs.readFile(staticPath, (err, data) => {
            if (err) return res.writeHead(500), void res.end(JSON.stringify({
                success: !1,
                message: "服务器错误"
            }));
            res.setHeader("Content-Type", contentType), res.end(data)
        })
    })
}
const server = http.createServer((req, res) => {
    if (["/verify", "/inquire"].includes(req.url) || "/" === req.url)
        if ("/" === req.url && "GET" === req.method) {
            const htmlPath = path.join(__dirname, "index.html");
            fs.readFile(htmlPath, "utf8", (err, data) => {
                if (err) return res.writeHead(500), void res.end(JSON.stringify({
                    success: !1,
                    message: "服务器错误"
                }));
                res.setHeader("Content-Type", "text/html; charset=utf-8"), res.end(data)
            })
        } else if ("/verify" === req.url && "POST" === req.method) {
            let postData = "";
            req.on("data", chunk => postData += chunk), req.on("end", () => {
                const formData = querystring.parse(postData),
                    {
                        userCode: userCode,
                        correctCode: correctCode
                    } = formData;
                if (userCode && correctCode)
                    if (userCode.toUpperCase() === correctCode.toUpperCase()) {
                        const uid = generateUID();
                        verifyStore[uid] = !0, res.end(JSON.stringify({
                            success: !0,
                            message: "验证成功",
                            uid: uid
                        }))
                    } else res.end(JSON.stringify({
                        success: !1,
                        message: "验证码错误"
                    }));
                else res.end(JSON.stringify({
                    success: !1,
                    message: "参数缺失"
                }))
            })
        } else if (req.url.startsWith("/inquire") && "GET" === req.method) {
            const uid = new URL(req.url, `http://${req.headers.host}`).searchParams.get("uid");
            if (!uid) return void res.end(JSON.stringify(!1));
            const isVerified = !0 === verifyStore[uid];
            res.end(JSON.stringify(isVerified))
        } else res.writeHead(404), res.end(JSON.stringify(!1));
    else serveStaticFile(req, res)
}),
    PORT = 3e3;
server.listen(3e3, () => {
    console.log("服务器已启动")
});