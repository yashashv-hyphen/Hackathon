"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { smoothGaze, resetSmoothing, getGazeTargetKey, freezeGaze } from "@/lib/gazeUtils";

// ---- Calibration mapping (linear regression coefficients) ----
export interface CalibrationMapping {
  ax: number; bx: number; // screenX = ax * irisX + bx
  ay: number; by: number; // screenY = ay * irisY + by
}

interface GazeContextType {
  x: number;
  y: number;
  isTracking: boolean;
  isReady: boolean;
  gazeTarget: string | null;
  debugInfo: string;
  rawIris: { x: number; y: number } | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  setCalibration: (mapping: CalibrationMapping | null) => void;
}

const GazeContext = createContext<GazeContextType>({
  x: 0,
  y: 0,
  isTracking: false,
  isReady: false,
  gazeTarget: null,
  debugInfo: "",
  rawIris: null,
  startTracking: async () => {},
  stopTracking: () => {},
  setCalibration: () => {},
});

export function useGaze() {
  return useContext(GazeContext);
}

export default function GazeProvider({ children }: { children: ReactNode }) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [gazeTarget, setGazeTarget] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [rawIris, setRawIris] = useState<{ x: number; y: number } | null>(null);

  const trackingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceLandmarkerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const calibrationRef = useRef<CalibrationMapping | null>(null);
  const lastBlinkTime = useRef(0);

  const BLINK_COOLDOWN = 1000; // ms between blink-clicks

  const setCalibration = useCallback((mapping: CalibrationMapping | null) => {
    calibrationRef.current = mapping;
    if (mapping) {
      resetSmoothing();
      console.log("[Gaze] Calibration set:", mapping);
    } else {
      console.log("[Gaze] Calibration cleared");
    }
  }, []);

  const tick = useCallback(() => {
    if (!trackingRef.current) return;

    const video = videoRef.current;
    const faceLandmarker = faceLandmarkerRef.current;

    if (video && faceLandmarker && video.readyState >= 2) {
      try {
        const now = performance.now();
        const results = faceLandmarker.detectForVideo(video, now);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];

          // ---- Blink detection FIRST (before iris) ----
          // Check blink before processing iris so we can freeze the cursor
          // and skip feeding garbage iris data during the blink frame.
          let blinkDetected = false;
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const blendshapes = results.faceBlendshapes[0].categories as any[];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const leftBlink = blendshapes.find((b: any) => b.categoryName === "eyeBlinkLeft");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rightBlink = blendshapes.find((b: any) => b.categoryName === "eyeBlinkRight");

            if (
              leftBlink && rightBlink &&
              leftBlink.score > 0.5 &&
              rightBlink.score < 0.3
            ) {
              blinkDetected = true;
              const blinkNow = Date.now();
              if (blinkNow - lastBlinkTime.current > BLINK_COOLDOWN) {
                lastBlinkTime.current = blinkNow;
                // Freeze cursor so it doesn't jump during the blink
                freezeGaze(12);
                // Dispatch synthetic ArrowRight so the existing switch handler picks it up
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "ArrowRight",
                    bubbles: true,
                    cancelable: true,
                  })
                );
                console.log("[Gaze] Wink detected — click!");
              }
            }
          }

          // ---- Iris tracking: landmark 474 = right iris center ----
          // Skip gaze update on blink frames — iris landmark is unreliable
          if (!blinkDetected) {
            const iris = landmarks[474];
            if (iris) {
              setRawIris({ x: iris.x, y: iris.y });

              // Map to screen coordinates if calibrated
              const cal = calibrationRef.current;
              if (cal) {
                const rawScreenX = cal.ax * iris.x + cal.bx;
                const rawScreenY = cal.ay * iris.y + cal.by;

                const clampedX = Math.max(0, Math.min(window.innerWidth, rawScreenX));
                const clampedY = Math.max(0, Math.min(window.innerHeight, rawScreenY));

                const smoothed = smoothGaze(clampedX, clampedY);

                const result = getGazeTargetKey(smoothed.x, smoothed.y);
                setGazeTarget(result.key);
                // Cursor snaps to key center when targeting a key, otherwise follows gaze
                setX(result.displayX);
                setY(result.displayY);
              }
            }
          }
        }
      } catch {
        // Detection can fail occasionally — just continue
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const startTracking = useCallback(async () => {
    if (typeof window === "undefined") return;

    // If already tracking, just clear calibration (recalibration flow)
    if (trackingRef.current) {
      calibrationRef.current = null;
      resetSmoothing();
      return;
    }

    try {
      setDebugInfo("Loading MediaPipe...");

      // Dynamic import to avoid SSR issues
      const vision = await import("@mediapipe/tasks-vision");
      const { FaceLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      setDebugInfo("Loading face model...");

      const faceLandmarker = await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        }
      );

      faceLandmarkerRef.current = faceLandmarker;
      setDebugInfo("Starting camera...");

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      streamRef.current = stream;

      // Create video element (used both for detection and display)
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText =
        "width:100%;height:100%;object-fit:cover;transform:scaleX(-1);border-radius:8px;";

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });

      videoRef.current = video;

      // Place video in webcam-container (retries in case container isn't mounted yet)
      const placeVideo = (retries = 0) => {
        const container = document.getElementById("webcam-container");
        if (container && videoRef.current) {
          container.innerHTML = "";
          container.appendChild(videoRef.current);
        } else if (retries < 30) {
          setTimeout(() => placeVideo(retries + 1), 500);
        }
      };
      placeVideo();

      resetSmoothing();

      trackingRef.current = true;
      setIsTracking(true);
      setIsReady(true);
      setDebugInfo("Tracking active");
      animFrameRef.current = requestAnimationFrame(tick);

      console.log("[Gaze] MediaPipe tracking active");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Gaze] FATAL:", err);
      setDebugInfo(`ERROR: ${msg}`);
    }
  }, [tick]);

  const stopTracking = useCallback(() => {
    trackingRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (faceLandmarkerRef.current) {
      try {
        faceLandmarkerRef.current.close();
      } catch {
        /* noop */
      }
      faceLandmarkerRef.current = null;
    }
    videoRef.current = null;
    setIsTracking(false);
    setGazeTarget(null);
    setRawIris(null);
    setDebugInfo("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current.close();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return (
    <GazeContext.Provider
      value={{
        x,
        y,
        isTracking,
        isReady,
        gazeTarget,
        debugInfo,
        rawIris,
        startTracking,
        stopTracking,
        setCalibration,
      }}
    >
      {children}
    </GazeContext.Provider>
  );
}
