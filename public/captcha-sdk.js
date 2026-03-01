/**
 * 验证码SDK
 * 用法：
 * 1. 在页面中创建一个div元素，设置id为"captcha-container"
 * 2. 引入本JS文件
 * 3. 验证码会自动加载到该div中
 * 
 * 配置选项：
 * - containerId: 验证码容器的ID，默认为"captcha-container"
 * - onSuccess: 验证成功的回调函数
 * - onError: 验证失败的回调函数
 * - onExpire: 验证码过期的回调函数
 */

(function() {
    // 默认配置
    const defaultConfig = {
        containerId: 'captcha-container',
        onSuccess: function(uid) {
            console.log('验证成功，UID:', uid);
        },
        onError: function(message) {
            console.log('验证失败:', message);
        },
        onExpire: function() {
            console.log('验证码已过期');
        }
    };

    // 验证码SDK类
    class CaptchaSDK {
        constructor(config) {
            this.config = Object.assign({}, defaultConfig, config);
            this.container = document.getElementById(this.config.containerId);
            this.currentToken = '';
            this.isVerifying = false;
            
            if (this.container) {
                this.init();
            } else {
                console.error('验证码容器未找到，请确保页面中存在id为"' + this.config.containerId + '"的div元素');
            }
        }

        // 初始化
        init() {
            this.container.innerHTML = `
                <div class="captcha-wrapper">
                    <div class="captcha-image" id="${this.config.containerId}-image"></div>
                    <div class="captcha-input-wrapper">
                        <input type="text" id="${this.config.containerId}-input" placeholder="请输入验证码" maxlength="4">
                        <button id="${this.config.containerId}-submit">验证</button>
                    </div>
                    <div class="captcha-message" id="${this.config.containerId}-message"></div>
                </div>
            `;

            // 添加样式
            this.addStyles();

            // 绑定事件
            this.bindEvents();

            // 加载验证码
            this.loadCaptcha();
        }

        // 添加样式
        addStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .captcha-wrapper {
                    font-family: Arial, sans-serif;
                    width: 300px;
                    margin: 0 auto;
                }
                .captcha-image {
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                    background-color: #f9f9f9;
                    text-align: center;
                }
                .captcha-image img {
                    vertical-align: middle;
                }
                .captcha-input-wrapper {
                    display: flex;
                    margin-bottom: 10px;
                }
                .captcha-input-wrapper input {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px 0 0 4px;
                    font-size: 16px;
                }
                .captcha-input-wrapper button {
                    padding: 0 15px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 0 4px 4px 0;
                    cursor: pointer;
                    font-size: 16px;
                }
                .captcha-input-wrapper button:hover {
                    background-color: #45a049;
                }
                .captcha-input-wrapper button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                .captcha-message {
                    font-size: 14px;
                    min-height: 20px;
                }
                .captcha-message.success {
                    color: #4CAF50;
                }
                .captcha-message.error {
                    color: #f44336;
                }
            `;
            document.head.appendChild(style);
        }

        // 绑定事件
        bindEvents() {
            // 验证按钮点击事件
            const submitBtn = document.getElementById(`${this.config.containerId}-submit`);
            submitBtn.addEventListener('click', () => this.verify());

            // 输入框回车事件
            const input = document.getElementById(`${this.config.containerId}-input`);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.verify();
                }
            });

            // 验证码图片点击事件（刷新验证码）
            const imageContainer = document.getElementById(`${this.config.containerId}-image`);
            imageContainer.addEventListener('click', () => this.loadCaptcha());
        }

        // 加载验证码
        async loadCaptcha() {
            try {
                this.setMessage('加载中...', '');
                const response = await fetch('/api/captcha', {
                    method: 'GET'
                });
                const result = await response.json();
                
                if (result.success) {
                    this.currentToken = result.token;
                    const imageContainer = document.getElementById(`${this.config.containerId}-image`);
                    imageContainer.innerHTML = `<img src="${result.captcha}" alt="验证码" style="cursor: pointer;">`;
                    this.setMessage('点击图片可刷新验证码', '');
                    document.getElementById(`${this.config.containerId}-input`).value = '';
                } else {
                    this.setMessage('验证码加载失败，请重试', 'error');
                    this.config.onError('验证码加载失败');
                }
            } catch (error) {
                this.setMessage('网络错误，请重试', 'error');
                this.config.onError('网络错误');
            }
        }

        // 验证验证码
        async verify() {
            if (this.isVerifying) return;
            
            const input = document.getElementById(`${this.config.containerId}-input`);
            const userCode = input.value.trim().toUpperCase();
            
            if (!userCode) {
                this.setMessage('请输入验证码', 'error');
                return;
            }
            
            if (!this.currentToken) {
                this.setMessage('请先加载验证码', 'error');
                return;
            }
            
            this.isVerifying = true;
            this.setMessage('验证中...', '');
            
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        userCode: userCode,
                        token: this.currentToken
                    })
                });
                
                const result = await response.json();
                this.isVerifying = false;
                
                if (result.success) {
                    this.setMessage('验证成功', 'success');
                    this.config.onSuccess(result.uid);
                    // 验证成功后重新加载验证码，以便下次使用
                    setTimeout(() => this.loadCaptcha(), 2000);
                } else {
                    this.setMessage(result.message || '验证码错误', 'error');
                    this.config.onError(result.message || '验证码错误');
                    // 验证失败后重新加载验证码
                    this.loadCaptcha();
                }
            } catch (error) {
                this.isVerifying = false;
                this.setMessage('网络错误，请重试', 'error');
                this.config.onError('网络错误');
            }
        }

        // 设置消息
        setMessage(text, type) {
            const messageElement = document.getElementById(`${this.config.containerId}-message`);
            messageElement.textContent = text;
            messageElement.className = `captcha-message ${type}`;
        }
    }

    // 全局函数，用于初始化验证码
    window.initCaptcha = function(config) {
        return new CaptchaSDK(config);
    };

    // 页面加载完成后自动初始化
    window.addEventListener('load', function() {
        if (document.getElementById('captcha-container')) {
            window.initCaptcha();
        }
    });
})();