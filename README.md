# 🔬 GazeLab — Virtual Lab Platform for Motor-Disabled Students

> *Empowering students with motor disabilities to participate in practical science experiments through the power of AI and eye-tracking technology.*

---

## 🏆 Hackathon Submission — Problem Statement 1
**Track:** Multimodal Assistive Technology for Individuals with Special Needs

---

## 🎯 The Problem

Students with motor disabilities — conditions like Parkinson's, cerebral palsy, dystonia, or tremors — are systematically **excluded from practical lab work** in schools and universities.

While their peers conduct titrations, build circuits, and perform dissections, motor-disabled students sit on the sidelines. Not because they lack the intellect. Not because they lack the curiosity. But because **no tool exists to bridge the gap between their mind and the lab bench.**

The consequences are real:
- 📉 Lower grades due to missed practical assessments
- 🎓 Reduced career opportunities in STEM fields
- 😔 Social exclusion and loss of confidence
- 🔬 A lifetime of "you can't do this" when they absolutely can

---

## 💡 Our Solution — GazeLab

**GazeLab** is an AI-powered virtual lab platform where motor-disabled students can perform **real science experiments using only their eyes.**

Upload a PDF lab manual → AI generates the virtual experiment → Student performs it with eye gaze → AI guides, assesses, and teaches in real time.

No hands required. No compromise on learning. Full participation. 🎯

---

## ✨ Key Features

### 👁️ Eye Tracker Control
- Custom-built eye tracking system detects where the student is looking
- Student selects equipment, pours solutions, connects circuits — all with eye gaze
- No mouse, no keyboard, no physical contact required

### 📄 PDF Lab Manual → Virtual Experiment
- Teacher uploads any PDF lab manual
- AI reads and understands the experiment
- Virtual lab environment is **automatically generated** with correct equipment
- Works with ANY school's curriculum, ANY subject, ANY country's syllabus

### 🤖 Agentic AI Assessment Loop
- AI continuously monitors every action the student takes
- Compares against correct procedure in real time
- **Wrong but safe step** → gentle encouraging hint
- **Dangerous step** → dramatic real-world consequence warning
  > *"⚠️ In a real lab, mixing these chemicals at this stage would cause a violent exothermic reaction and release toxic fumes!"*
- Teaches real lab discipline, not just button clicking

### ♿ Disability-Adapted Instructions
- Original lab instructions often require precise hand movements
- Our LLM **rewrites every step** for eye-gaze interaction
- Scientific accuracy preserved, physical barriers removed

### 🎙️ Voice-Powered Lab Assistant (RAG Chatbot)
- Student speaks a question — no typing needed
- Whisper STT converts speech to text
- AI answers using the **actual lab manual as context** (not generic knowledge)
- Knows exactly which step the student is on
- Encouraging, warm, patient — like a real lab supervisor

### 🔒 Real Consequences, Safe Environment
- Virtual environment means zero physical risk
- But consequences of wrong actions are **simulated and explained**
- Student learns why safety matters, not just what to do

---

## 🏗️ System Architecture

```
PDF Lab Manual Uploaded
         ↓
   NLP PDF Parser
   (extracts raw structure)
         ↓
   Modifier LLM (Groq/Llama)
   (adapts steps for eye gaze,
    adds equipment mappings)
         ↓
   SQLite Database
   (stores experiment, steps,
    precautions)
         ↓
   Virtual Lab Frontend
   (renders SVG equipment icons,
    activates eye tracker)
         ↓
   Student performs experiment
   with eye gaze
         ↓
═══════════════════════════════
   AGENTIC AI LOOP (real time)
   Observe → Compare → Critique
   → Feedback → Repeat
═══════════════════════════════
         ↓
   Voice Chatbot available
   anytime for questions
         ↓
   Experiment Complete →
   Assessment Report Generated
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI + Python |
| **Database** | SQLite + SQLAlchemy |
| **LLM** | Groq API (Llama 3.3 70B) |
| **PDF Parsing** | PyPDF |
| **Speech to Text** | OpenAI Whisper |
| **Eye Tracking** | Custom built (MediaPipe) |
| **Frontend** | React + SVG animations |
| **Server** | Uvicorn |

---

## 🤖 Why This Is Genuinely Agentic AI

GazeLab doesn't just use an LLM as a chatbot. The AI has:

- ✅ A **persistent goal** — guide student to complete experiment correctly
- ✅ **Memory** — tracks every action student has taken
- ✅ **Tool use** — calls different functions based on what it observes
- ✅ **Decision making** — independently decides when to intervene
- ✅ **Reflection loop** — critiques every step against ground truth
- ✅ **Adaptation** — responds differently to dangerous vs safe mistakes

This is a **ReAct pattern agent** running continuously throughout the experiment.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Upload PDF lab manual, returns virtual experiment data |
| `POST` | `/action` | Submit student eye gaze action, returns AI feedback |
| `POST` | `/chatbot` | Submit voice question, returns AI answer |

---

## 🚀 Getting Started

### Prerequisites
```bash
pip install fastapi uvicorn sqlalchemy pypdf groq openai-whisper torch python-dotenv
```

Also install ffmpeg system-wide:
```bash
# Windows
winget install ffmpeg

# Mac
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

### Environment Setup
Create a `.env` file in the backend folder:
```
GROQ_API_KEY=your_groq_api_key_here
```

Get your free Groq API key at: [console.groq.com](https://console.groq.com)
if you aren't able to access the API, contact Telegram: @YashashvSamtani

### Run the Server
```bash
uvicorn main:app --reload
```

Server runs at `http://localhost:8000` 🚀

---

## 📁 Project Structure

```
backend/
├── main.py              ← FastAPI endpoints
├── llm.py               ← LLM client setup
├── prompts.py           ← All LLM prompts
├── pdf_parser.py        ← PDF text extraction
├── modify_instruct.py   ← Adapts steps for disability
├── comparing_llm.py     ← Agentic assessment loop
├── audio_to_text.py     ← Whisper STT
├── database.py          ← SQLAlchemy engine
├── database_models.py   ← DB table definitions
├── models.py            ← Pydantic schemas
└── .env                 ← API keys (never commit!)

frontend/
├── src/
│   ├── components/
│   │   ├── LabScreen/   ← Virtual lab environment
│   │   ├── Chatbot/     ← Voice chatbot UI
│   │   └── Upload/      ← PDF upload screen
│   └── assets/
│       └── equipment/   ← SVG lab equipment icons
└── hackathon/
    └── chemistry-lab/   ← Eye tracker core
```

---

## 🌍 Impact & Scalability

- 🏫 Works with **any school's existing PDF lab manuals** — zero extra work for teachers
- 🌐 Supports **any science subject** — chemistry, physics, biology
- ♾️ **Infinitely expandable** — new experiments just require uploading a PDF
- 🌏 **Regional friendly** — no dependency on specific curriculum
- 📱 **Web based** — works on any device with a camera

---

## 🎯 Multimodal Coverage

| Modality | Implementation |
|----------|---------------|
| 👁️ **Vision** | Eye tracker for all interactions |
| 🔊 **Audio** | Voice input via Whisper STT |
| 📝 **Text** | Instructions, feedback, chatbot responses |
| 🤖 **AI** | Agentic loop + RAG chatbot + step adapter |

---

## 👥 The Problem We're Really Solving

> *"1 billion people worldwide live with some form of disability. Motor disabilities affect millions of students globally. Yet practical science education — a gateway to STEM careers — remains almost entirely inaccessible to them."*

GazeLab doesn't just give motor-disabled students a workaround. It gives them **full, equal participation** in the most hands-on part of science education.

Because every student deserves to see the pH paper change colour. 🔬

---

*Built with ❤️ for students who were told they couldn't do practical science. They can now.*
