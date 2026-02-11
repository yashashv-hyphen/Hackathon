# Virtual Lab Platform — Motor-Disabled Students

Frontend for the Virtual Lab: upload a lab manual (PDF), perform steps with gaze/eye control, get feedback from the backend, and use voice chatbot when stuck.

## Run locally

1. **Start the backend** (FastAPI / uvicorn):

   ```bash
   cd Hackathon/backend
   uvicorn main:app --reload
   ```
   Default API: **http://localhost:8000**

2. **Serve the frontend** (so CORS and file paths work):

   ```bash
   cd Hackathon/hackathon/chemistry-lab
   python -m http.server 8080
   ```
   Open: **http://localhost:8080**

   Or use Live Server in VS Code / Cursor (often port 5500). If your frontend runs on another port, add it to `main.py` CORS `allow_origins`.

3. **In the app**
   - Click “Use eyes” to enable gaze/mouse pointer (stare or blink to click).
   - Choose a lab manual PDF and click **Upload**.
   - After the response loads, the lab view shows procedure, precautions, and materials (icons). `current_step` starts at 1.
   - Click apparatus/chemicals to perform actions; each click sends an action to the backend. Correct → step advances and observation icon/text; wrong → soft or red warning.
   - Use the **chatbot** (💬) to record a voice question; the app sends base64 audio to the backend (STT + LLM) and shows the text response.

## API base URL

In `app.js`, `API_BASE` is set to `http://localhost:8000`. Change it if your backend runs on another host/port.

## Icon names (for lab manual / modifier_llm)

Use **lowercase with underscores** in your PDF (or modifier output) so the frontend can match SVG icons in `icons/`:

**Apparatus:** `burette`, `conical_flask`, `beaker`, `pipette`, `dropper`, `glass_rod`, `funnel`, `white_tile`, `stand`, `beaker_tongs`, `test_tube`, `ph_paper`, `colour_chart`

**Chemicals:** any string (e.g. `given_solution`, `naoh`, `hcl`, `phenolphthalein`). Display only; no SVG required.

See `icons/ICON_NAMES.md` for the full list.

## Tech

- Plain HTML, CSS, and JavaScript.
- **gaze.js** — eye/mouse pointer and dwell/blink-to-click (same idea as Intuition v12.0).
- **app.js** — upload, lab view, action tracking (`/action`), and voice chatbot (`/chatbot` with base64 audio for stt.py).
