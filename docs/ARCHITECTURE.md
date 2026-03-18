# Architecture Documentation

## System Overview

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Web[Web PWA<br/>React + TypeScript]
        Desktop[Desktop App<br/>Electron]
    end

    subgraph Backend["Backend Orchestrator"]
        API[API Gateway<br/>Express + WebSocket]
        STT[STT Service<br/>Whisper/Azure]
        LLM[LLM Router<br/>Provider Pattern]
        RAG[RAG Engine<br/>Vector Search]
        Session[Session Manager]
    end

    subgraph Storage["Storage Layer"]
        Cache[Redis Cache]
        Vector[Vector DB<br/>Qdrant/Chroma]
        Files[File Storage]
    end

    Web -->|WebSocket| API
    Desktop -->|WebSocket| API
    
    API --> STT
    API --> LLM
    API --> RAG
    API --> Session
    
    STT --> Cache
    LLM --> Cache
    RAG --> Vector
    RAG --> Files
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend UI
    participant WS as WebSocket
    participant STT as STT Engine
    participant DET as Question Detector
    participant RAG as RAG Pipeline
    participant LLM as LLM Orchestrator

    User->>UI: Starts Interview Session
    UI->>WS: Send start_session
    WS->>UI: Session confirmed

    User->>UI: Interviewer speaks
    UI->>STT: Stream audio chunk
    STT->>STT: Process audio (VAD +降噪)
    STT-->>UI: Transcription (partial)
    STT-->>UI: Transcription (final)

    UI->>DET: Send transcription
    DET->>DET: Analyze for question patterns
    DET-->>UI: Question detected

    UI->>RAG: Retrieve context
    RAG-->>UI: Relevant documents

    UI->>LLM: Generate response
    LLM->>LLM: Stream tokens
    LLM-->>UI: Response chunks
    UI->>User: Display suggestion
```

## Module Architecture

### 1. STT Engine

```mermaid
flowchart LR
    subgraph AudioCapture
        Mic[Microphone]
        Sys[System Audio]
    end

    subgraph Processing
        VAD[VAD Detection]
        NS[Noise Suppression]
        Chunk[Audio Chunking]
    end

    subgraph Transcription
        Provider[STT Provider]
        Stream[Stream Handler]
    end

    AudioCapture --> Processing
    Processing --> Transcription
    Transcription --> Output[Transcription Output]
```

### 2. LLM Orchestrator

```mermaid
flowchart TB
    Request[API Request] --> Queue[Request Queue]
    Queue --> Scheduler[Priority Scheduler]
    
    Scheduler --> Cache{Cache Hit?}
    Cache -->|Yes| Response[Cached Response]
    Cache -->|No| Provider[LLM Provider]
    
    Provider --> Router{Provider Router}
    Router --> OpenAI[OpenAI]
    Router --> Anthropic[Anthropic]
    Router --> Google[Google]
    Router --> Ollama[Ollama]
    
    OpenAI --> Stream[Stream Handler]
    Anthropic --> Stream
    Google --> Stream
    Ollama --> Stream
    
    Stream --> Response
    Response --> CacheStore[Update Cache]
```

### 3. RAG Pipeline

```mermaid
flowchart TB
    subgraph Ingestion
        Upload[Document Upload]
        Parse[Parser<br/>PDF/DOCX/TXT]
        Split[Text Splitter]
        Embed[Embedding Model]
    end

    subgraph Storage
        VectorDB[(Vector Database)]
        MetaDB[(Metadata DB)]
    end

    subgraph Retrieval
        Query[User Query]
        EmbedQ[Query Embedding]
        Search[Hybrid Search<br/>BM25 + Dense]
        Rerank[Reranker]
    end

    Upload --> Parse
    Parse --> Split
    Split --> Embed
    Embed --> VectorDB

    Query --> EmbedQ
    EmbedQ --> Search
    VectorDB --> Search
    Search --> Rerank
    Rerank --> Context[Context Output]
```

### 4. Stealth Engine

```mermaid
flowchart TB
    Events[User Events] --> Handler[Event Handler]
    
    Handler --> Visibility{Visibility Check}
    Handler --> Capture{Capture Detection}
    Handler --> Hotkey[Emergency Hotkey]

    Visibility --> Hide[Hide Window]
    Capture --> Exclude[Exclude from Capture]
    Hotkey --> Emergency[Emergency Hide]

    Hide --> CSS[CSS Manipulation]
    Exclude --> API[Native API<br/>SetWindowDisplayAffinity]
    Emergency --> Clear[Clear UI]

    CSS --> Output[Hidden State]
    API --> Output
    Clear --> Output
```

## Component Interactions

```mermaid
graph LR
    subgraph Frontend
        Store[Zustand Store]
        Components[React Components]
        Services[Services<br/>WebSocket/Audio]
    end

    subgraph Backend
        Modules[Core Modules]
        API[REST API]
        WS[WebSocket Server]
    end

    Components --> Store
    Components --> Services
    Services --> WS
    WS --> API
    API --> Modules
    Store -.->|Updates| Components
```

## State Management

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Connecting: Start Session
    Connecting --> Active: Connected
    Active --> Paused: Pause
    Paused --> Active: Resume
    Active --> Processing: Question Detected
    Processing --> Generating: Generate Response
    Generating --> Active: Response Complete
    Active --> Ending: End Session
    Ending --> Idle: Session Ended
    
    Active --> Hidden: Stealth Mode
    Hidden --> Active: Show
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 | UI Framework |
| State | Zustand | State Management |
| Styling | TailwindCSS | CSS Framework |
| Backend | Node.js + Express | API Server |
| Real-time | WebSocket | Bi-directional Communication |
| STT | Whisper.cpp/Azure | Speech-to-Text |
| LLM | OpenAI/Anthropic | Response Generation |
| RAG | LangChain | Document Processing |
| Vector | bge-small-zh | Embeddings |
| Desktop | Electron | Cross-platform App |

## Security Architecture

```mermaid
flowchart TB
    subgraph Security["Security Layers"]
        Auth[Authentication]
        Encrypt[Encryption]
        Sanitize[Data Sanitization]
        RateLimit[Rate Limiting]
    end

    subgraph Privacy["Privacy Features"]
        Local[Local Processing]
        Ephemeral[Ephemeral Storage]
        Stealth[Stealth Mode]
    end

    Request --> Auth
    Auth --> RateLimit
    RateLimit --> Encrypt
    Encrypt --> Sanitize
    Sanitize --> Processing

    Processing --> Local
    Processing --> Ephemeral
    Processing --> Stealth
```

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| End-to-end Latency | < 2s | ~500ms (mock) |
| STT Processing | < 300ms | ~100ms |
| LLM Response | < 1.5s | ~800ms |
| Memory Usage | < 300MB | ~150MB |
| CPU Usage | < 15% | ~8% |

## Scalability

```mermaid
flowchart LR
    subgraph LB["Load Balancer"]
        NGINX[Nginx]
    end

    subgraph App["Application Tier"]
        Node1[Node.js 1]
        Node2[Node.js 2]
        Node3[Node.js 3]
    end

    subgraph Cache["Cache Tier"]
        Redis[Redis Cluster]
    end

    subgraph DB["Database Tier"]
        Vector[Vector DB]
        Session[Session Store]
    end

    LB --> Node1
    LB --> Node2
    LB --> Node3

    Node1 --> Redis
    Node2 --> Redis
    Node3 --> Redis

    Redis --> Vector
    Redis --> Session
```

---

For implementation details, see individual module documentation in `/docs/modules/`.
