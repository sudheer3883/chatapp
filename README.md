# Real-Time Communication Platform (WhatsApp / Telegram Clone)

A modern, high-performance, dark-mode first Full-Stack Web Application built for real-time messaging, media sharing, and peer-to-peer 1-on-1 audio/video calling.

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, `react-easy-crop`
- **Backend**: Node.js, Express.js, Multer (Memory Storage)
- **Real-Time Engine**: Socket.io (Presence, receipts, typing, WebRTC signaling)
- **Calling**: WebRTC (1-on-1 Peer-to-Peer, Screen Sharing, Audio/Video)
- **Database & Storage**: MongoDB (Mongoose), Cloudinary (Avatars & Chat Media)
- **Authentication**: JWT with secure HTTP-only cookies and bcrypt password hashing

---

## Features

1. **Advanced Profile & Avatar (DP) Management**:
   - 1:1 circular image cropper with live zoom slider & 90° rotation.
   - Stream upload to Cloudinary with automated face-centering crop (`g_face,c_fill`).
   - Automated cleanup of obsolete Cloudinary assets when avatars are changed or removed.
   - Fallback initials avatar with dynamic deterministic gradient colors.
   - Fullscreen high-resolution DP viewer with download button.
   - Multi-tab presence tracking with real-time online/offline indicators.
   - Live DP broadcast to all active contacts via Socket.io.

2. **One-on-One Real-Time Chat**:
   - Direct messaging with cursor-based MongoDB message persistence.
   - Dynamic typing indicators ("*Alex is typing...*").
   - Delivery and read receipts (Single tick -> Double grey tick -> Blue double tick).
   - Unread badge counters per conversation.

3. **Media & File Sharing**:
   - Voice note recorder with live timer, MediaRecorder WebM compression, and inline audio player.
   - High-res photo sharing with instant preview.
   - Document sharing with file size badge and download link.
   - Optimistic message rendering for instant feedback.

4. **1-on-1 Audio & Video Calling (WebRTC)**:
   - Socket.io signaling relay for SDP offers, answers, and ICE candidate exchange.
   - Incoming call popup alert with caller avatar, name, and Accept/Decline actions.
   - In-call controls: Mute microphone, toggle camera, screen sharing, end call.
   - Picture-in-picture (PIP) floating local camera overlay.

---

## Quick Start Guide

### 1. Environment Setup
Create `backend/.env` using `backend/.env.example`:

```bash
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=your_super_secret_jwt_key

# Cloudinary Credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Install Dependencies
```bash
# In backend directory:
cd backend
npm install

# In frontend directory:
cd ../frontend
npm install
```

### 3. Start Development Servers
```bash
# Terminal 1 (Backend on port 5000):
cd backend
npm run dev

# Terminal 2 (Frontend on port 5173):
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.
