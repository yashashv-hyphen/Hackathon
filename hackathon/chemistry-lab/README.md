# Virtual Chemistry Lab — Titration Experiment

A simple front-end virtual chemistry lab that runs in the browser. Focus: **acid–base titration** (NaOH vs HCl with phenolphthalein).

## Run on localhost

**Option 1 — Open the file**

- Open `index.html` in a browser (double-click or File → Open).  
- Works offline; no server required.

**Option 2 — Local HTTP server (recommended)**

```bash
cd chemistry-lab
python3 -m http.server 8080
```

Then open: **http://localhost:8080**

Or with Node:

```bash
npx serve -p 3000
```

Then open: **http://localhost:3000**

## Deploy online (free)

The app is static (HTML/CSS/JS only), so any static host works.

### GitHub Pages

1. Create a new repo on GitHub, then in your project folder:

   ```bash
   cd /home/venom/hackathon/chemistry-lab
   git init
   git add .
   git commit -m "Virtual chemistry lab"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. On GitHub: **Settings → Pages → Source**: choose **main** branch, folder **/ (root)**. Save.
3. Your site will be at `https://YOUR_USERNAME.github.io/YOUR_REPO/` after a minute or two.

### Netlify (drag & drop)

1. Go to [netlify.com](https://www.netlify.com) and sign in.
2. Drag the **chemistry-lab** folder onto the Netlify “Deploy” area.
3. You get a live URL like `https://random-name.netlify.app` (you can rename it in Site settings).

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From the project folder:

   ```bash
   cd /home/venom/hackathon/chemistry-lab
   vercel
   ```

3. Follow the prompts; you’ll get a URL such as `https://chemistry-lab-xxx.vercel.app`.

## Features

- **Burette** — Click to open/close the tap; liquid level drops and drips animate.
- **Conical flask** — Click to “swirl” the flask (mixing animation).
- **Beaker** — Click for a short “pour” animation.
- **Stand** — Click for a small adjustment animation.
- **Start Titration** — Runs a full titration: tap opens, drops fall, flask solution turns pink at the endpoint.
- **Reset Lab** — Restores initial volumes and state.
- **Eyes mode** — Click **“Use eyes (blink to click)”** in the header to enable eye tracking: a green cursor follows your gaze; **blink** to click (apparatus, buttons, etc.). Uses the same MediaPipe-based tracking as the main IntuitionV12.0 app and the eyes-as-mouse browser extension. Requires camera access and a modern browser (Chrome recommended).

## Tech

- Plain HTML, CSS, and JavaScript.
- No build step; deploy by serving the `chemistry-lab` folder on any static host or localhost.
