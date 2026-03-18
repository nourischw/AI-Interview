# Deployment Guide

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Production Deployment](#production-deployment)
4. [Configuration Reference](#configuration-reference)
5. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd AI-Interview

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env and add your API keys
# LLM_API_KEY=your-api-key

# Start development servers
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Development Commands

```bash
# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

---

## Docker Deployment

### Dockerfile (Backend)

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY shared ./shared
COPY backend ./backend

# Build
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/shared/dist ./shared

# Copy package.json for scripts
COPY backend/package.json ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - LLM_PROVIDER=openai
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### Build and Run

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Production Deployment

### Environment Variables

Create a `.env.production` file:

```bash
# Server
NODE_ENV=production
PORT=3001

# STT
STT_PROVIDER=azure
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=eastus

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
LLM_MODEL=gpt-4-turbo
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=500

# Security
SESSION_SECRET=your-secure-random-string
CORS_ORIGINS=https://your-domain.com

# Features
ENABLE_STEALTH=true
ENABLE_RAG=true
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        root /var/www/ai-interview;
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline';" always;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'ai-interview-backend',
      script: './backend/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
```

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

---

## Configuration Reference

### STT Providers

| Provider | Configuration | Cost | Latency |
|----------|---------------|------|---------|
| Mock | `STT_PROVIDER=mock` | Free | <100ms |
| Whisper.cpp | `STT_PROVIDER=whisper` | Free | 200-500ms |
| Azure Speech | `STT_PROVIDER=azure` | $1/15min | <200ms |
| Deepgram | `STT_PROVIDER=deepgram` | $0.0078/min | <150ms |

### LLM Providers

| Provider | Configuration | Cost | Latency |
|----------|---------------|------|---------|
| OpenAI GPT-3.5 | `LLM_PROVIDER=openai` | $0.002/1K tokens | 500-1000ms |
| OpenAI GPT-4 | `LLM_MODEL=gpt-4-turbo` | $0.01/1K tokens | 1000-2000ms |
| Anthropic Claude | `LLM_PROVIDER=anthropic` | $0.003/1K tokens | 500-1500ms |
| Ollama (Local) | `LLM_PROVIDER=ollama` | Free | 1000-3000ms |

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failed

```bash
# Check if backend is running
curl http://localhost:3001/health

# Check firewall rules
sudo ufw status

# Verify CORS settings
# Ensure CORS_ORIGINS includes your frontend URL
```

#### 2. Audio Not Working

```bash
# Check browser permissions
# Chrome: chrome://settings/content/microphone

# Verify audio input device
navigator.mediaDevices.enumerateDevices()

# Test audio capture
# See frontend/src/services/audio.ts
```

#### 3. High Latency

```bash
# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/status

# Check server resources
htop
docker stats

# Reduce model size or use caching
# LLM_MODEL=gpt-3.5-turbo (faster than GPT-4)
```

#### 4. Memory Issues

```bash
# Set Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Enable garbage collection logging
NODE_OPTIONS="--trace-gc" npm start

# Check for memory leaks
npm install clinic
npx clinic doctor -- node dist/index.js
```

### Logs

```bash
# View application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f backend

# PM2 logs
pm2 logs ai-interview-backend
```

### Performance Monitoring

```bash
# Enable detailed logging
LOG_LEVEL=debug

# Monitor API endpoints
# Add middleware like morgan or pino-http

# Use APM tools
# npm install @datadog/pprof
# npm install clinic
```

---

## Security Checklist

- [ ] Change default SESSION_SECRET
- [ ] Enable HTTPS in production
- [ ] Configure CORS properly
- [ ] Rate limiting enabled
- [ ] API keys stored in environment variables
- [ ] Regular dependency updates
- [ ] Firewall configured
- [ ] Logs sanitized (no sensitive data)

---

## Support

For issues and questions:
- GitHub Issues: [Create an issue]
- Documentation: `/docs` folder
- Email: support@example.com
