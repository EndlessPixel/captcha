const canvas = document.getElementById('captcha-canvas');
const userCodeInput = document.getElementById('userCode');
const submitBtn = document.getElementById('submit-btn');
const modal = document.getElementById('tip-modal');
const modalText = document.getElementById('modal-text');
const modalUid = document.getElementById('modal-uid');
const modalClose = document.getElementById('modal-close');
canvas.oncontextmenu = () => false;
canvas.ondragstart = () => false;
canvas.oncopy = () => false;
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
function getRandomChar() {
    const chars = Object.keys(dotMatrixFont);
    return chars[Math.floor(Math.random() * chars.length)];
}
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
let correctCode = '';
function generateCaptcha() {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, width, height);
    correctCode = '';
    for (let i = 0; i < 4; i++) correctCode += getRandomChar();
    for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgb(${Math.random() * 60 + 180},${Math.random() * 60 + 180},${Math.random() * 60 + 180})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
    for (let i = 0; i < 4; i++) {
        const char = correctCode[i];
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
    userCodeInput.value = '';
}
function showModal(text, isSuccess, uid = '') {
    modalText.textContent = text;
    modalText.className = isSuccess ? 'modal-success' : 'modal-error';
    if (isSuccess && uid) {
        modalUid.textContent = `验证通过，您的验证UID：${uid}`;
        // http(s)://{ip/domain}(:{port})/inquire?uid={uid} 查询验证状态，可接入任何脚本网页或者机器人框架
        modalUid.style.display = 'block';
    } else {
        modalUid.style.display = 'none';
    }
    modal.style.display = 'flex';
}
submitBtn.onclick = async () => {
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
            body: new URLSearchParams({
                userCode: userCode,
                correctCode: correctCode
            })
        });
        const result = await response.json();
        if (result.success) {
            showModal('验证码验证成功！', true, result.uid);
            modalClose.onclick = () => {
                modal.style.display = 'none';
                generateCaptcha();
            };
        } else {
            showModal(result.message || '验证码错误！', false);
            modalClose.onclick = () => {
                modal.style.display = 'none';
                generateCaptcha();
            };
        }
    } catch (error) {
        showModal('服务器出错，请稍后重试！', false);
        modalClose.onclick = () => modal.style.display = 'none';
    }
};
window.onload = generateCaptcha;
canvas.onclick = generateCaptcha;
modalClose.onclick = () => modal.style.display = 'none';