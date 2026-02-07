// 页面加载完成后执行
window.onload = async function () {
    const canvas = document.getElementById('captcha-canvas');
    const userCodeInput = document.getElementById('userCode');
    const submitBtn = document.getElementById('submit-btn');
    const modal = document.getElementById('tip-modal');
    const modalText = document.getElementById('modal-text');
    const modalUid = document.getElementById('modal-uid');
    const modalClose = document.getElementById('modal-close');

    // ========== 新增：篡改猴检测核心函数 ==========
    function detectTampermonkey() {
        // 检测1：全局变量特征（Tampermonkey/Greasemonkey/Violentmonkey）
        const hasUserScriptVars = !!(
            window.Tampermonkey ||
            window.Greasemonkey ||
            window.Violentmonkey ||
            window.$tm ||
            window.$gm
        );

        // 检测2：插件注入的DOM特征
        let hasScriptDom = false;
        try {
            // 检查是否有插件注入的脚本标签
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                const src = script.src || '';
                // 匹配常见的用户脚本插件特征
                if (
                    src.includes('tampermonkey') ||
                    src.includes('greasemonkey') ||
                    src.includes('violentmonkey') ||
                    script.getAttribute('data-tm-script') ||
                    script.getAttribute('data-gm-script')
                ) {
                    hasScriptDom = true;
                    break;
                }
            }
        } catch (e) { }

        // 检测3：navigator属性篡改检测
        let hasNavigatorTamper = false;
        try {
            // 保存原始navigator属性
            const originalNavigator = window.navigator;
            // 插件可能会重写navigator的toString方法
            if (
                originalNavigator.toString.toString().includes('tampermonkey') ||
                originalNavigator.toString.toString().includes('greasemonkey')
            ) {
                hasNavigatorTamper = true;
            }
        } catch (e) { }

        // 任意一项检测到则判定为安装了用户脚本插件
        return hasUserScriptVars || hasScriptDom || hasNavigatorTamper;
    }

    // ========== 新增：插件检测处理逻辑 ==========
    function handleUserScriptDetection() {
        const isTampermonkeyInstalled = detectTampermonkey();

        if (isTampermonkeyInstalled) {
            // 禁用所有交互元素
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
            userCodeInput.disabled = true;
            canvas.style.pointerEvents = 'none';
            canvas.style.opacity = '0.7';

            // 显示强制提示弹窗
            showModal(
                '检测到您的浏览器安装了Tampermonkey（篡改猴）/Greasemonkey等用户脚本插件！<br/>' +
                '为确保验证的安全性，您需要：<br/>' +
                '1. 卸载该插件 或<br/>' +
                '2. 临时禁用该插件<br/>' +
                '操作完成后请刷新页面重试。',
                false
            );

            // 覆盖关闭按钮事件，防止用户关闭弹窗继续操作
            modalClose.onclick = function () {
                alert('必须卸载/禁用用户脚本插件才能继续使用！');
            };

            return false;
        } else {
            // 正常启用交互元素
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            userCodeInput.disabled = false;
            canvas.style.pointerEvents = 'auto';
            canvas.style.opacity = '1';
            return true;
        }
    }

    // 禁止canvas右键/拖拽/复制
    canvas.oncontextmenu = () => false;
    canvas.ondragstart = () => false;
    canvas.oncopy = () => false;

    // 点阵字体（不变）
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

    // 绘制点阵字符（不变）
    function drawDotMatrixChar(ctx, char, x, y, size, color) {
        const matrix = dotMatrixFont[char];
        const dotSize = size / 6;
        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] === 1) {
                    const offsetX = (Math.random() - 0.5) * 2;
                    const offsetY = (Math.random() - 0.5) * 2;
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        x + col * dotSize + offsetX,
                        y + row * dotSize + offsetY,
                        dotSize - 1,
                        dotSize - 1
                    );
                }
            }
        }
    }

    // 从后端获取验证码并绘制
    async function generateCaptcha() {
        // 先检测插件，检测到则直接返回
        if (!handleUserScriptDetection()) {
            return;
        }

        try {
            const response = await fetch('/get-captcha', {
                method: 'GET',
                credentials: 'include' // 携带Cookie（sessionId）
            });
            const result = await response.json();
            if (!result.success) {
                showModal(result.message || '验证码加载失败！', false);
                return;
            }

            // 仅用于绘制的验证码字符（前端不再存储正确答案）
            const captchaCode = result.captchaCode;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            // 清空画布
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(0, 0, width, height);

            // 绘制干扰点
            for (let i = 0; i < 80; i++) {
                ctx.fillStyle = `rgb(${Math.random() * 60 + 180},${Math.random() * 60 + 180},${Math.random() * 60 + 180})`;
                ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
            }

            // 绘制验证码字符
            for (let i = 0; i < 4; i++) {
                const char = captchaCode[i];
                const baseX = 20 + i * 25;
                const baseY = 25;
                const size = 24;
                const rotate = (Math.random() - 0.5) * 20;
                const color = `rgb(${Math.floor(Math.random() * 80 + 20)},${Math.floor(Math.random() * 80 + 20)},${Math.floor(Math.random() * 80 + 20)})`;

                ctx.save();
                ctx.translate(baseX + size / 2, baseY + size / 2);
                ctx.rotate(rotate * Math.PI / 180);
                drawDotMatrixChar(ctx, char, -size / 2, -size / 2, size, color);
                ctx.restore();
            }

            // 清空输入框
            userCodeInput.value = '';
        } catch (error) {
            showModal('验证码加载出错，请稍后重试！', false);
            console.error('验证码加载失败：', error);
        }
    }

    // 显示弹窗（支持HTML内容）
    function showModal(text, isSuccess, uid = '') {
        modalText.innerHTML = text; // 修改为innerHTML以支持换行
        modalText.className = isSuccess ? 'modal-success' : 'modal-error';
        if (isSuccess && uid) {
            modalUid.textContent = `验证通过，您的验证UID：${uid}`;
            modalUid.style.display = 'block';
        } else {
            modalUid.style.display = 'none';
        }
        modal.style.display = 'flex';
    }

    // 提交验证（仅传用户输入的验证码）
    submitBtn.onclick = async () => {
        // 提交前再次检测插件
        if (!handleUserScriptDetection()) {
            return;
        }

        const userCode = userCodeInput.value.trim().toUpperCase();
        if (!userCode) {
            showModal('请输入验证码！', false);
            return;
        }

        try {
            const response = await fetch('/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                credentials: 'include', // 携带Cookie（sessionId）
                body: new URLSearchParams({
                    userCode: userCode // 仅传用户输入，不再传correctCode
                })
            });

            const result = await response.json();
            if (result.success) {
                showModal('验证码验证成功！', true, result.uid);
                modalClose.onclick = () => {
                    modal.style.display = 'none';
                    generateCaptcha(); // 验证成功后刷新验证码
                };
            } else {
                showModal(result.message || '验证码错误！', false);
                modalClose.onclick = () => {
                    modal.style.display = 'none';
                    generateCaptcha(); // 验证失败后刷新验证码
                };
            }
        } catch (error) {
            showModal('服务器出错，请稍后重试！', false);
            modalClose.onclick = () => modal.style.display = 'none';
            console.error('验证请求失败：', error);
        }
    };

    // 绑定事件
    canvas.onclick = generateCaptcha; // 点击刷新验证码
    modalClose.onclick = () => modal.style.display = 'none';

    // 初始化：先检测插件，再加载验证码
    handleUserScriptDetection();
    await generateCaptcha();

    // 新增：定时检测（防止用户在页面加载后启用插件）
    setInterval(handleUserScriptDetection, 3000);
};