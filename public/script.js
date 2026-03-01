// 页面加载完成后执行
window.onload = async function () {
    const canvas = document.getElementById('captcha-canvas');
    const userCodeInput = document.getElementById('userCode');
    const submitBtn = document.getElementById('submit-btn');
    const modal = document.getElementById('tip-modal');
    const modalText = document.getElementById('modal-text');
    const modalUid = document.getElementById('modal-uid');
    const modalClose = document.getElementById('modal-close');

    // 防止XSS攻击的文本转义函数
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 生成随机检测令牌
    const detectionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    window._detectToken = detectionToken;

    // ========== 高级插件检测核心函数 ==========
    function detectTampermonkey() {
        // 检测1：全局变量特征（Tampermonkey/Greasemonkey/Violentmonkey）
        const hasUserScriptVars = !!(window.Tampermonkey || window.Greasemonkey || window.Violentmonkey || window.$tm || window.$gm);

        // 检测2：插件注入的DOM特征
        let hasScriptDom = false;
        try {
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                const src = script.src || '';
                if (src.includes('tampermonkey') || src.includes('greasemonkey') || src.includes('violentmonkey') || script.getAttribute('data-tm-script') || script.getAttribute('data-gm-script')) {
                    hasScriptDom = true;
                    break;
                }
            }
        } catch (e) { }

        // 检测3：navigator属性篡改检测
        let hasNavigatorTamper = false;
        try {
            const originalNavigator = window.navigator;
            if (originalNavigator.toString.toString().includes('tampermonkey') || originalNavigator.toString.toString().includes('greasemonkey')) {
                hasNavigatorTamper = true;
            }
        } catch (e) { }

        // 检测4：控制台检测
        let hasConsoleTamper = false;
        try {
            const originalConsole = window.console;
            if (typeof originalConsole.log !== 'function' || originalConsole.log.toString().includes('tampermonkey')) {
                hasConsoleTamper = true;
            }
        } catch (e) { }

        // 检测5：脚本执行环境检测
        let hasScriptEnvTamper = false;
        try {
            // 检测是否有脚本注入的特征
            const scriptContent = document.documentElement.outerHTML;
            if (scriptContent.includes('tampermonkey') || scriptContent.includes('greasemonkey')) {
                hasScriptEnvTamper = true;
            }
        } catch (e) { }

        // 检测6：函数重写检测
        let hasFunctionTamper = false;
        try {
            // 检测detectTampermonkey函数是否被重写
            if (typeof detectTampermonkey !== 'function' || detectTampermonkey.toString().length < 500) {
                hasFunctionTamper = true;
            }
        } catch (e) {
            hasFunctionTamper = true;
        }

        // 任意一项检测到则判定为安装了用户脚本插件
        return hasUserScriptVars || hasScriptDom || hasNavigatorTamper || hasConsoleTamper || hasScriptEnvTamper || hasFunctionTamper;
    }

    // ========== 插件检测处理逻辑 ==========
    function handleUserScriptDetection() {
        // 检查检测令牌是否被篡改
        if (window._detectToken !== detectionToken) {
            // 令牌被篡改，判定为有插件
            showModal(
                '检测到您的浏览器环境异常！\n' +
                '为确保验证的安全性，您需要：\n' +
                '1. 卸载Tampermonkey（篡改猴）/Greasemonkey等用户脚本插件 或\n' +
                '2. 临时禁用该插件\n' +
                '操作完成后请刷新页面重试。',
                false
            );
            disableAllInteractions();
            return false;
        }

        const isTampermonkeyInstalled = detectTampermonkey();

        if (isTampermonkeyInstalled) {
            disableAllInteractions();
            showModal(
                '检测到您的浏览器安装了Tampermonkey（篡改猴）/Greasemonkey等用户脚本插件！\n' +
                '为确保验证的安全性，您需要：\n' +
                '1. 卸载该插件 或\n' +
                '2. 临时禁用该插件\n' +
                '操作完成后请刷新页面重试。',
                false
            );
            modalClose.onclick = function () {
                alert('必须卸载/禁用用户脚本插件才能继续使用！');
            };
            return false;
        } else {
            enableAllInteractions();
            return true;
        }
    }

    // 禁用所有交互元素
    function disableAllInteractions() {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        userCodeInput.disabled = true;
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = '0.7';
    }

    // 启用所有交互元素
    function enableAllInteractions() {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        userCodeInput.disabled = false;
        canvas.style.pointerEvents = 'auto';
        canvas.style.opacity = '1';
    }

    // 增强Canvas保护
    function protectCanvas() {
        // 禁用右键/拖拽/复制
        canvas.oncontextmenu = () => false;
        canvas.ondragstart = () => false;
        canvas.oncopy = () => false;
        
        // 防止通过Canvas API读取
        const originalGetContext = canvas.getContext;
        canvas.getContext = function(type) {
            if (type === '2d') {
                const ctx = originalGetContext.call(this, type);
                if (ctx) {
                    // 重写getImageData方法
                    const originalGetImageData = ctx.getImageData;
                    ctx.getImageData = function() {
                        throw new Error('Canvas access denied');
                    };
                    // 重写toDataURL方法
                    const originalToDataURL = this.toDataURL;
                    this.toDataURL = function() {
                        throw new Error('Canvas access denied');
                    };
                }
                return ctx;
            }
            return originalGetContext.call(this, type);
        };
    }

    // 从后端获取验证码并显示
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
            
            if (!response.ok) {
                showModal('验证码加载失败！', false);
                return;
            }
            
            // 获取SVG内容
            const captchaSVG = await response.text();
            
            // 创建临时img元素来显示SVG
            const img = new Image();
            img.onload = function() {
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                
                // 清空画布
                ctx.fillStyle = '#f8f8f8';
                ctx.fillRect(0, 0, width, height);
                
                // 绘制SVG验证码
                ctx.drawImage(img, 0, 0, width, height);
            };
            
            img.onerror = function() {
                showModal('验证码加载出错，请稍后重试！', false);
            };
            
            // 将SVG转换为data URL并设置为img的src
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(captchaSVG)));

            // 清空输入框
            userCodeInput.value = '';
        } catch (error) {
            showModal('验证码加载出错，请稍后重试！', false);
            console.error('验证码加载失败：', error);
        }
    }

    // 显示弹窗（安全的文本显示）
    function showModal(text, isSuccess, uid = '') {
        // 使用textContent防止XSS攻击
        modalText.textContent = text;
        modalText.className = isSuccess ? 'modal-success' : 'modal-error';
        if (isSuccess && uid) {
            modalUid.textContent = `验证通过，您的验证UID：${escapeHtml(uid)}`;
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

        // 验证输入格式
        if (!/^[A-Z0-9]{4}$/.test(userCode)) {
            showModal('验证码格式错误，请输入4位字母或数字！', false);
            return;
        }

        try {
            // 生成前端检测结果
            const detectionResult = {
                hasUserScript: detectTampermonkey(),
                token: detectionToken,
                timestamp: Date.now()
            };

            const response = await fetch('/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                credentials: 'include', // 携带Cookie（sessionId）
                body: new URLSearchParams({
                    userCode: userCode,
                    detection: JSON.stringify(detectionResult)
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

    // 增强事件监听，防止事件被移除
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener) {
        // 防止移除关键事件监听器
        if (type === 'click' && this === submitBtn) {
            return;
        }
        return originalAddEventListener.call(this, type, listener);
    };

    // 增强定时器，防止被清除
    const originalSetInterval = window.setInterval;
    const intervals = [];
    window.setInterval = function(callback, delay) {
        const id = originalSetInterval(callback, delay);
        intervals.push(id);
        return id;
    };

    const originalClearInterval = window.clearInterval;
    window.clearInterval = function(id) {
        // 不允许清除我们的检测定时器
        if (!intervals.includes(id)) {
            return originalClearInterval(id);
        }
    };

    // 初始化：先检测插件，再加载验证码
    handleUserScriptDetection();
    protectCanvas();
    await generateCaptcha();

    // 定时检测（防止用户在页面加载后启用插件）
    const detectionInterval = setInterval(() => {
        handleUserScriptDetection();
        // 定期更新检测令牌
        window._detectToken = detectionToken;
    }, 5000);
    intervals.push(detectionInterval);
};