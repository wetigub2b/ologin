// PM2 Ecosystem Configuration
// Start with: pm2 start ecosystem.config.js
// Or simply: pm2 start

module.exports = {
  apps: [{
    name: 'oauth-login',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
