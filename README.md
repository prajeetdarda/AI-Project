# Multimodal AI Discovery Platform

A production-ready AI platform featuring intelligent recommendation systems powered by advanced technologies including RAG, fine-tuned neural networks, and semantic search.

Built by [Prajeet Darda](https://www.linkedin.com/in/prajeet-darda) | [GitHub](https://github.com/prajeetdarda) | prajeetdarda@gmail.com

## 🚀 Live Demo

Visit the live application: [AI Discovery Platform](https://auto-crm-project.vercel.app)

## ✨ Features

### 🎬 Movie Recommender
RAG-based semantic search powered by LangChain, Pinecone, and OpenSearch
- **Semantic retrieval** with vector embeddings
- **Sub-second latency** on AWS Lambda
- Handles **1k+ daily queries** efficiently
- Hybrid search combining vector similarity and keyword matching

### 🎵 Audio-Based Music Discovery
Fine-tuned PANNs (CNN14) for intelligent playlist generation from audio features
- **95% accuracy** in audio feature detection
- Trained on **6k+ tracks** with custom ML pipeline
- **Personalized recommendations** via GPT integration
- Real-time audio analysis and feature extraction

## 🛠️ Technology Stack

| Technology | Purpose |
|------------|---------|
| **LangGraph** | Orchestration |
| **LangChain** | AI Framework |
| **OpenAI GPT-4o** | LLM Engine |
| **Next.js 15** | React Framework |
| **TypeScript** | Type Safety |
| **SQLite** | Database |
| **Tailwind CSS** | Styling |
| **Pinecone** | Vector Database |
| **OpenSearch** | Keyword Search |
| **AWS Lambda** | Serverless Functions |
| **AWS S3** | Data Storage |
| **FastAPI** | ML Inference API |
| **PANNs (CNN14)** | Audio Neural Networks |

## 📋 Getting Started

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm/bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/prajeetdarda/AI-Project.git
cd AI-Project/web
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your API keys:
- OpenAI API key
- Pinecone API key
- AWS credentials
- FastAPI endpoint URL

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser


## 🎯 Key Features

### Movie Recommender (RAG)
1. **Intent parsing**: LLM interprets queries and extracts relevant genres/keywords
2. **Hybrid retrieval**: Searches Pinecone (semantic) and OpenSearch (keyword BM25)
3. **Grounded generation**: LangChain prompts LLM with citations
4. **AWS automation**: Lambda functions auto-refresh embeddings and indexes

### Audio Discovery (ML Pipeline)
1. **Data curation**: Scraped 6k+ tracks with metadata
2. **Embedding model**: Fine-tuned PANNs (CNN14) via transfer learning
3. **Feature prediction**: Multi-task head predicts Spotify-style attributes
4. **Recommendation engine**: Integrated with Spotify Web API
5. **LLM curation**: GPT refines candidates with rationales

## 🚢 Deployment

The application is deployed on:
- **Frontend**: Vercel
- **ML Inference**: Render (FastAPI)
- **Cloud Functions**: AWS Lambda
- **Storage**: AWS S3

## 📊 Performance Metrics

- **Movie Recommender**: Sub-second latency, 1k+ daily queries
- **Audio Model**: 95% accuracy in feature detection
- **Dataset**: 6k+ tracks processed and analyzed

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the MIT License.

## 👤 Author

**Prajeet Darda**
- LinkedIn: [linkedin.com/in/prajeet-darda](https://www.linkedin.com/in/prajeet-darda)
- GitHub: [github.com/prajeetdarda](https://github.com/prajeetdarda)
- Email: prajeetdarda@gmail.com

## 🙏 Acknowledgments

- OpenAI for GPT-4o
- Pinecone for vector database
- AWS for cloud infrastructure
- Vercel for hosting platform
