# 🎯 AI Interview Assistant

A real-time AI-powered interview assistant that transcribes interviewer speech and generates professional response suggestions instantly.

> **⚠️ Compliance Notice**: This tool is for interview practice and preparation only. Using it in actual interviews may violate platform terms or local laws.

## Features

- 🎤 **Real-time Speech-to-Text**: Transcribe interviewer speech with <2s latency
- 🤖 **AI Response Generation**: Professional answers using STAR principle
- 🛡️ **Privacy & Stealth**: Anti-detection technology for screen sharing
- 📚 **RAG Knowledge Base**: Upload resumes/documents for contextual answers
- 🌐 **Multi-platform**: Web PWA + Desktop (Electron) support

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
ai-interview/
├── frontend/          # React + PWA web application
├── backend/           # Node.js orchestrator service
├── desktop/           # Electron desktop application
├── shared/            # Shared types and utilities
└── docs/              # Documentation
```

## Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, PWA
- **Backend**: Node.js, Express, WebSocket
- **Desktop**: Electron, node-microphone
- **AI**: Whisper.cpp, OpenAI/Claude/Ollama providers
- **RAG**: LangChain, bge-small-zh embeddings

## License

MIT - For educational purposes only
