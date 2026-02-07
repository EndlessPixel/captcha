Dot Matrix CAPTCHA

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Browser Support](https://img.shields.io/badge/Browser-Chrome%2060%2B%20%7C%20Firefox%2055%2B%20%7C%20Safari%2011%2B%20%7C%20Edge%2079%2B-brightgreen.svg)](https://caniuse.com/)

A lightweight, anti-OCR dot-matrix CAPTCHA system designed to prevent automated bot recognition through distorted text rendering. Developed by the system_mini member of EndlessPixel Studio.

Overview

This project implements a server-side CAPTCHA system that generates dot-matrix style verification codes with random distortions to resist OCR-based attacks. It provides both the image generation frontend and verification backend.

Features

• Dot Matrix Characters: Uses a custom 5x3 dot matrix pattern for alphanumeric characters

• Anti-OCR Protection: Random rotation, noise dots, and positional jitter

• Server-Side Validation: Secure token-based verification system

• Simple API: RESTful endpoints for verification and status checks

• Lightweight: Minimal dependencies, easy to deploy

Installation

1. Clone the repository:
```bash
# use Git to clone the repository
git clone https://github.com/EndlessPixel/captcha.git
# or use GitHub CLI
gh repo clone EndlessPixel/captcha
# change directory to the project folder
cd captcha
```

2. Start the server:
```bash
# start the server
node server.js
```


The server will run on port 3000 by default.

API Endpoints

1. CAPTCHA Verification

• Endpoint: POST /verify

• Content-Type: application/x-www-form-urlencoded

• Parameters:

  • userCode: User-input CAPTCHA code

  • correctCode: Actual CAPTCHA code (sent from frontend)

• Success Response:
```json
{
  "success": true,
  "message": "Verification successful",
  "uid": "xxxx-xxxx-xxxx-xxxx-xxxx"
}
```

• Error Response:
```json
{
  "success": false,
  "message": "Verification code error"
}
```


2. Verification Status Check

• Endpoint: GET /inquire?uid={verification_uid}

• Response: Returns true if verified, false if not

Integration Guide

Frontend Integration

1. Include the CAPTCHA canvas in your HTML:
```html
<div class="captcha-box">
  <canvas id="captcha-canvas" width="140" height="50"></canvas>
  <input type="text" name="userCode" id="userCode" maxlength="4" required>
</div>
```

2. Add the JavaScript and CSS files to your project.

Backend Integration

1. For Form Validation:
   • Store the generated CAPTCHA code in session/server-side

   • Send both userCode and correctCode to /verify endpoint

   • Use the returned UID for future verification status checks

2. For API Protection:
   • Require CAPTCHA verification before sensitive operations

   • Use the /inquire endpoint to verify UID status

Configuration

Modify server.js to change:
• Server port (default: 3000)

• Verification token storage and expiration

• CAPTCHA character set

Security Considerations

• The CAPTCHA excludes easily confused characters (1, I, 0, O, etc.)

• Server-side validation prevents client-side tampering

• Verification tokens are randomly generated and stored

• Implement rate limiting in production environments

Browser Support

• Chrome `60+`

• Firefox `55+`

• Safari `11+`

• Edge `79+`

Project Structure

```
captcha/
├── index.html    # Main HTML file
├── server.js     # Node.js server
├── public/       # Public assets
│   ├── style.css # Stylesheet
│   └── script.js # Frontend logic
├── LICENSE       # MIT License
└── README.md     # This file
```

License

MIT License `© 2024-2026 EndlessPixel Studio`

Contact

• Project URL: https://github.com/EndlessPixel/captcha

• Developer: system_mini (EndlessPixel Studio)