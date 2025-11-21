require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const startEmailSyncJob = require('./jobs/emailSyncJob');

const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// 🟢 AUTH SUCCESS PAGE
app.get('/auth/success', (req, res) => {
  const token = req.query.token;
  
  if (!token) {
    return res.redirect('/auth/error?message=No token found');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login Successful</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 800px;
          width: 100%;
        }
        h1 {
          color: #4CAF50;
          margin-bottom: 20px;
          font-size: 28px;
        }
        .user-info {
          background: #e3f2fd;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          display: none;
        }
        .user-info h3 {
          margin-bottom: 15px;
          color: #333;
        }
        .user-info p {
          margin: 8px 0;
          color: #555;
        }
        .token-section {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .token-section h3 {
          margin-bottom: 15px;
          color: #333;
        }
        .token-box {
          background: white;
          padding: 15px;
          border: 2px solid #4CAF50;
          border-radius: 8px;
          word-break: break-all;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          max-height: 150px;
          overflow-y: auto;
          margin: 10px 0;
          line-height: 1.5;
        }
        button {
          background: #4CAF50;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          margin-right: 10px;
          margin-top: 10px;
          transition: background 0.3s;
        }
        button:hover {
          background: #45a049;
        }
        .logout-btn {
          background: #f44336;
        }
        .logout-btn:hover {
          background: #da190b;
        }
        .logout-all-btn {
          background: #ff9800;
        }
        .logout-all-btn:hover {
          background: #e68900;
        }
        .success-msg {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .api-examples {
          background: #e7f3ff;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .api-examples h3 {
          margin-bottom: 15px;
          color: #333;
        }
        .api-examples p {
          margin: 10px 0;
          color: #555;
        }
        code {
          background: #f4f4f4;
          padding: 3px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: #d63384;
        }
        .copied-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 15px 25px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          display: none;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .tip {
          color: #666;
          margin-top: 30px;
          font-size: 14px;
          padding: 15px;
          background: #fff3cd;
          border-radius: 8px;
          border-left: 4px solid #ffc107;
        }
        @media (max-width: 600px) {
          .container {
            padding: 20px;
          }
          h1 {
            font-size: 24px;
          }
          button {
            width: 100%;
            margin-right: 0;
          }
        }
      </style>
    </head>
    <body>
      <div id="notification" class="copied-notification">✅ Token copied!</div>
      
      <div class="container">
        <h1>🎉 Login Successful!</h1>
        
        <div class="success-msg">
          ✅ Your email sync has started automatically in the background!
        </div>

        <div id="userInfo" class="user-info">
          <h3>👤 User Information</h3>
          <p><strong>Name:</strong> <span id="userName">Loading...</span></p>
          <p><strong>Email:</strong> <span id="userEmail">Loading...</span></p>
          <p><strong>Last Sync:</strong> <span id="lastSync">Never</span></p>
        </div>

        <div class="token-section">
          <h3>📱 Your Access Token</h3>
          <div class="token-box" id="tokenBox">${token}</div>
          <button onclick="copyToken()">📋 Copy Token</button>
          <button onclick="testAPI()">🧪 Test API</button>
          <button class="logout-btn" onclick="logout()">🚪 Logout</button>
          <button class="logout-all-btn" onclick="logoutAll()">🔐 Logout All Devices</button>
        </div>

        <div class="api-examples">
          <h3>🚀 Quick Start - Test Your API</h3>
          <p><strong>1. Get your emails:</strong></p>
          <code>GET http://localhost:5000/api/emails</code>
          <p style="margin-top: 10px;"><strong>2. Add header:</strong></p>
          <code>Authorization: Bearer YOUR_TOKEN</code>
          <p style="margin-top: 15px;"><strong>3. Example with curl:</strong></p>
          <code style="display: block; margin-top: 8px; padding: 10px; background: #2d2d2d; color: #f8f8f2;">
            curl -H "Authorization: Bearer ${token.substring(0, 30)}..." http://localhost:5000/api/emails
          </code>
        </div>

        <div class="tip">
          💡 <strong>Tip:</strong> Your token has been saved to localStorage. You can safely refresh this page.
        </div>
      </div>

      <script>
        const token = "${token}";
        const API_URL = 'http://localhost:5000/api';
        
        // Save to localStorage
        localStorage.setItem('gmail_token', token);
        localStorage.setItem('gmail_token_saved_at', new Date().toISOString());

        // Load user info
        async function loadUserInfo() {
          try {
            const response = await fetch(API_URL + '/auth/me', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            
            if (response.ok) {
              const data = await response.json();
              document.getElementById('userName').textContent = data.user.name;
              document.getElementById('userEmail').textContent = data.user.email;
              document.getElementById('lastSync').textContent = 
                data.user.lastSyncedAt 
                  ? new Date(data.user.lastSyncedAt).toLocaleString() 
                  : 'Never';
              document.getElementById('userInfo').style.display = 'block';
            }
          } catch (error) {
            console.error('Failed to load user info:', error);
          }
        }

        function copyToken() {
          navigator.clipboard.writeText(token).then(() => {
            showNotification('✅ Token copied to clipboard!');
          });
        }

        function showNotification(message) {
          const notif = document.getElementById('notification');
          notif.textContent = message;
          notif.style.display = 'block';
          setTimeout(() => {
            notif.style.display = 'none';
          }, 2000);
        }

        async function testAPI() {
          try {
            const response = await fetch(API_URL + '/auth/me', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            
            const data = await response.json();
            
            if (response.ok) {
              showNotification('✅ API Test Successful!');
              console.log('User data:', data);
              alert('✅ API Test Successful!\\n\\nUser: ' + data.user.name + '\\nEmail: ' + data.user.email);
            } else {
              showNotification('❌ API Test Failed');
              alert('❌ API Test Failed\\n\\n' + JSON.stringify(data, null, 2));
            }
          } catch (error) {
            alert('❌ Error: ' + error.message);
          }
        }

        async function logout() {
          if (!confirm('Are you sure you want to logout from this device?')) {
            return;
          }

          try {
            const response = await fetch(API_URL + '/auth/logout', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token }
            });

            const data = await response.json();

            if (response.ok) {
              // Clear localStorage
              localStorage.removeItem('gmail_token');
              localStorage.removeItem('gmail_token_saved_at');
              
              showNotification('✅ Logged out successfully!');
              
              // Redirect after 1 second
              setTimeout(() => {
                window.location.href = '/auth/logged-out';
              }, 1000);
            } else {
              alert('❌ Logout failed: ' + data.error);
            }
          } catch (error) {
            alert('❌ Error: ' + error.message);
          }
        }

        async function logoutAll() {
          if (!confirm('⚠️ This will logout from ALL devices. Continue?')) {
            return;
          }

          try {
            const response = await fetch(API_URL + '/auth/logout-all', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token }
            });

            const data = await response.json();

            if (response.ok) {
              // Clear localStorage
              localStorage.removeItem('gmail_token');
              localStorage.removeItem('gmail_token_saved_at');
              
              showNotification('✅ Logged out from all devices!');
              
              // Redirect after 1 second
              setTimeout(() => {
                window.location.href = '/auth/logged-out';
              }, 1000);
            } else {
              alert('❌ Logout failed: ' + data.error);
            }
          } catch (error) {
            alert('❌ Error: ' + error.message);
          }
        }

        // Load user info on page load
        window.onload = () => {
          loadUserInfo();
        };
      </script>
    </body>
    </html>
  `);
});

// 🟢 AUTH ERROR PAGE
app.get('/auth/error', (req, res) => {
  const message = req.query.message || 'An error occurred during authentication';
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login Failed</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 600px;
          width: 100%;
        }
        h1 {
          color: #f44336;
          margin-bottom: 20px;
          font-size: 28px;
        }
        .error-box {
          background: #ffebee;
          border-left: 4px solid #f44336;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .error-box p {
          margin: 8px 0;
          color: #555;
        }
        .info-box {
          background: #e3f2fd;
          border-left: 4px solid #2196F3;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .info-box ul {
          margin-left: 20px;
          margin-top: 10px;
        }
        .info-box li {
          margin: 5px 0;
          color: #555;
        }
        .btn {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: bold;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #45a049;
        }
        @media (max-width: 600px) {
          .container {
            padding: 20px;
          }
          h1 {
            font-size: 24px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>❌ Login Failed</h1>
        
        <div class="error-box">
          <p><strong>Error:</strong></p>
          <p>${decodeURIComponent(message)}</p>
        </div>

        <div class="info-box">
          <strong>💡 Common causes:</strong>
          <ul>
            <li>The authorization code has already been used (page was refreshed)</li>
            <li>The authorization request expired</li>
            <li>Network connectivity issues</li>
            <li>Invalid OAuth client configuration</li>
          </ul>
        </div>

        <a href="/api/auth/google" class="btn">🔄 Try Login Again</a>
      </div>
    </body>
    </html>
  `);
});

// 🟢 LOGGED OUT PAGE
app.get('/auth/logged-out', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logged Out</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 600px;
          width: 100%;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin: 20px 0;
        }
        h1 {
          color: #4CAF50;
          margin-bottom: 20px;
          font-size: 28px;
        }
        .message {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .message p {
          margin: 8px 0;
        }
        .btn {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: bold;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #45a049;
        }
        @media (max-width: 600px) {
          .container {
            padding: 20px;
          }
          h1 {
            font-size: 24px;
          }
          .icon {
            font-size: 48px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">👋</div>
        <h1>Successfully Logged Out</h1>
        
        <div class="message">
          <p>✅ You have been logged out successfully!</p>
          <p>Your token has been invalidated and removed from this device.</p>
        </div>

        <a href="/api/auth/google" class="btn">🔐 Login Again</a>
      </div>

      <script>
        // Ensure token is cleared from localStorage
        localStorage.removeItem('gmail_token');
        localStorage.removeItem('gmail_token_saved_at');
      </script>
    </body>
    </html>
  `);
});

// Connect to database
connectDB();

// Start cron job
startEmailSyncJob();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});