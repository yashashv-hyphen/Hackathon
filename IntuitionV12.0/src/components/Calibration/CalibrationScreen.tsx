"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGaze } from "@/components/EyeTracker/GazeProvider";

interface CalibrationScreenProps {
  onComplete: () => void;
}

const CALIBRATION_POINTS = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 50, y: 50 },
  { x: 10, y: 90 },
  { x: 90, y: 90 },
];

const COLLECT_TIME = 800;
const STABILITY_WINDOW = 15; // samples to check for stability
const STABILITY_THRESHOLD = 0.002; // max std dev of nose position to consider "stable"
const MAX_WAIT = 5000; // fallback: collect anyway after 5s even if not stable

type Phase = "camera" | "intro" | "calibrating" | "done";

export default function CalibrationScreen({
  onComplete,
}: CalibrationScreenProps) {
  const { startTracking, isTracking, rawIris, setCalibration } = useGaze();
  const [phase, setPhase] = useState<Phase>(isTracking ? "intro" : "camera");
  const [currentPoint, setCurrentPoint] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);

  const collectedRef = useRef<
    { irisX: number; irisY: number; screenXPct: number; screenYPct: number }[]
  >([]);
  const samplesRef = useRef<{ x: number; y: number }[]>([]);
  const irisRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    irisRef.current = rawIris;
  }, [rawIris]);

  const requestCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPhase("intro");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowed") || msg.includes("denied")) {
        setCameraError(
          "Camera access was denied. Please allow camera access in your browser settings and reload."
        );
      } else {
        setCameraError(`Could not access camera: ${msg}`);
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    await startTracking();
    setCalibration(null);
    collectedRef.current = [];
    setPhase("calibrating");
  }, [startTracking, setCalibration]);

  const computeCalibration = useCallback(() => {
    const points = collectedRef.current;
    const n = points.length;
    if (n < 3) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let sumIX = 0, sumSX = 0, sumIX2 = 0, sumIXSX = 0;
    let sumIY = 0, sumSY = 0, sumIY2 = 0, sumIYSY = 0;

    for (const p of points) {
      const sx = (p.screenXPct / 100) * screenW;
      const sy = (p.screenYPct / 100) * screenH;
      sumIX += p.irisX;
      sumSX += sx;
      sumIX2 += p.irisX * p.irisX;
      sumIXSX += p.irisX * sx;
      sumIY += p.irisY;
      sumSY += sy;
      sumIY2 += p.irisY * p.irisY;
      sumIYSY += p.irisY * sy;
    }

    const denomX = n * sumIX2 - sumIX * sumIX;
    const denomY = n * sumIY2 - sumIY * sumIY;

    if (Math.abs(denomX) < 1e-10 || Math.abs(denomY) < 1e-10) return;

    const ax = (n * sumIXSX - sumIX * sumSX) / denomX;
    const bx = (sumSX - ax * sumIX) / n;
    const ay = (n * sumIYSY - sumIY * sumSY) / denomY;
    const by = (sumSY - ay * sumIY) / n;

    console.log(`[Cal] Computed from ${n} points:`, { ax, bx, ay, by });
    setCalibration({ ax, bx, ay, by });
  }, [setCalibration]);

  // --- Auto-collection per point with stability detection ---
  const hasIris = !!rawIris;
  const recentRef = useRef<{ x: number; y: number }[]>([]);
  const collectStartRef = useRef<number | null>(null);
  const pointStartRef = useRef<number>(0);

  useEffect(() => {
    if (phase !== "calibrating" || !hasIris) return;

    samplesRef.current = [];
    recentRef.current = [];
    setCollecting(false);
    collectStartRef.current = null;
    pointStartRef.current = Date.now();

    const interval = setInterval(() => {
      const iris = irisRef.current;
      if (!iris) return;

      // Always push to recent window for stability check
      recentRef.current.push({ ...iris });
      if (recentRef.current.length > STABILITY_WINDOW) {
        recentRef.current.shift();
      }

      if (collectStartRef.current !== null) {
        // We're collecting — gather samples
        samplesRef.current.push({ ...iris });

        if (Date.now() - collectStartRef.current >= COLLECT_TIME) {
          // Done collecting this point
          clearInterval(interval);
          setCollecting(false);

          const samples = samplesRef.current;
          if (samples.length > 0) {
            const avgX = samples.reduce((s, p) => s + p.x, 0) / samples.length;
            const avgY = samples.reduce((s, p) => s + p.y, 0) / samples.length;

            collectedRef.current.push({
              irisX: avgX,
              irisY: avgY,
              screenXPct: CALIBRATION_POINTS[currentPoint].x,
              screenYPct: CALIBRATION_POINTS[currentPoint].y,
            });
          }

          const next = currentPoint + 1;
          if (next >= CALIBRATION_POINTS.length) {
            computeCalibration();
            setPhase("done");
          } else {
            setCurrentPoint(next);
          }
        }
      } else {
        // Not collecting yet — check stability
        const recent = recentRef.current;
        const elapsed = Date.now() - pointStartRef.current;

        let isStable = false;
        if (recent.length >= STABILITY_WINDOW) {
          const meanX = recent.reduce((s, p) => s + p.x, 0) / recent.length;
          const meanY = recent.reduce((s, p) => s + p.y, 0) / recent.length;
          const stdX = Math.sqrt(recent.reduce((s, p) => s + (p.x - meanX) ** 2, 0) / recent.length);
          const stdY = Math.sqrt(recent.reduce((s, p) => s + (p.y - meanY) ** 2, 0) / recent.length);
          isStable = stdX < STABILITY_THRESHOLD && stdY < STABILITY_THRESHOLD;
        }

        // Start collecting if stable OR if we've waited too long
        if (isStable || elapsed > MAX_WAIT) {
          collectStartRef.current = Date.now();
          samplesRef.current = [];
          setCollecting(true);
        }
      }
    }, 33);

    return () => clearInterval(interval);
  }, [phase, currentPoint, hasIris, computeCalibration]);

  // --- Done ---
  useEffect(() => {
    if (phase === "done") {
      const timer = setTimeout(onComplete, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // ===================== Render =====================

  if (phase === "camera") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 mb-6 rounded-full bg-editor-accent/20 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-editor-accent">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        {cameraError ? (
          <>
            <h2 className="text-2xl font-bold mb-3 text-editor-error">Camera Access Denied</h2>
            <p className="text-gray-400 mb-6 max-w-md text-center">{cameraError}</p>
            <div className="flex gap-4">
              <button onClick={requestCamera} className="px-6 py-2.5 bg-editor-accent hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors">Try Again</button>
              <button onClick={onComplete} className="px-6 py-2.5 bg-editor-border hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">Continue without tracking</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-3">Camera Access Required</h2>
            <p className="text-gray-400 mb-4 max-w-md text-center">
              AccessCode needs your camera for head tracking. Click below to allow camera access.
            </p>
            <div className="flex gap-4 mt-4">
              <button onClick={requestCamera} className="px-8 py-3 bg-editor-accent hover:bg-blue-500 text-white text-lg font-semibold rounded-lg transition-colors">Allow Camera</button>
              <button onClick={onComplete} className="px-8 py-3 bg-editor-border hover:bg-gray-600 text-gray-300 text-lg rounded-lg transition-colors">Skip</button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 mb-6 rounded-full bg-editor-success/20 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-editor-success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold mb-3">Camera Connected</h2>
        <p className="text-gray-400 mb-2 max-w-lg text-center">
          Look at each dot as it appears. Calibration is automatic.
        </p>
        <p className="text-gray-500 text-sm mb-2 max-w-lg text-center">
          Sit 50–60 cm from your webcam with your face well-lit and centered.
        </p>
        <p className="text-gray-500 text-sm mb-8 max-w-lg text-center">
          If you experience erratic cursor movement, please recalibrate.
        </p>
        <div className="flex gap-4">
          <button onClick={handleStart} className="px-8 py-3 bg-editor-accent hover:bg-blue-500 text-white text-lg font-semibold rounded-lg transition-colors">
            Begin Calibration
          </button>
          <button onClick={onComplete} className="px-8 py-3 bg-editor-border hover:bg-gray-600 text-gray-300 text-lg rounded-lg transition-colors">Skip</button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-50 calibration-fadeout">
        <div className="w-20 h-20 mb-6 rounded-full bg-editor-success/20 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-editor-success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold mb-3 text-editor-success">Calibration Complete</h2>
        <p className="text-gray-400 text-sm">Entering the editor...</p>
      </div>
    );
  }

  // ---------- Calibrating ----------
  const point = CALIBRATION_POINTS[currentPoint];
  const progress = ((currentPoint + (collecting ? 0.5 : 0)) / CALIBRATION_POINTS.length) * 100;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 overflow-hidden">
      <div className="absolute top-0 left-0 h-1 bg-editor-accent transition-all duration-300" style={{ width: `${progress}%` }} />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white text-xl font-semibold">Look at the dot</p>
        <p className="text-gray-400 text-sm mt-2">
          Point {currentPoint + 1} of {CALIBRATION_POINTS.length}
          {collecting && <span className="text-editor-accent ml-2">Collecting...</span>}
        </p>
      </div>

      <div
        className={`absolute rounded-full flex items-center justify-center transition-all duration-300 ${
          collecting ? "bg-green-500 scale-110" : "bg-editor-accent animate-pulse"
        }`}
        style={{
          width: 56,
          height: 56,
          left: `calc(${point.x}vw - 28px)`,
          top: `calc(${point.y}vh - 28px)`,
          boxShadow: collecting
            ? "0 0 20px rgba(52, 211, 153, 0.4)"
            : "0 0 20px rgba(56, 139, 253, 0.3)",
          transition: "left 0.3s, top 0.3s, transform 0.3s",
        }}
      >
        <div className="w-3 h-3 rounded-full bg-white" />
      </div>

      <button onClick={onComplete} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 text-sm bg-editor-border hover:bg-gray-600 text-gray-400 rounded-lg transition-colors">
        Skip
      </button>
    </div>
  );
}
