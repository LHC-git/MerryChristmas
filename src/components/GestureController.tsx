import { useRef, useEffect } from 'react';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

interface GestureControllerProps {
  onGesture: (gesture: string) => void;
  onMove: (speed: number) => void;
  onStatus: (status: string) => void;
  debugMode: boolean;
  enabled: boolean;
  onPinch?: (pos: { x: number; y: number }) => void;
  isPhotoSelected: boolean;
}

export const GestureController = ({
  onGesture,
  onMove,
  onStatus,
  debugMode,
  enabled,
  onPinch,
  isPhotoSelected
}: GestureControllerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const callbacksRef = useRef({ onGesture, onMove, onStatus, debugMode, onPinch, isPhotoSelected });
  callbacksRef.current = { onGesture, onMove, onStatus, debugMode, onPinch, isPhotoSelected };

  useEffect(() => {
    if (!enabled) {
      callbacksRef.current.onStatus("AI DISABLED");
      return;
    }

    let gestureRecognizer: GestureRecognizer | null = null;
    let requestRef: number;
    let isActive = true;
    let pinchCooldown = 0;

    const setup = async () => {
      callbacksRef.current.onStatus("LOADING AI...");
      try {
        // 优先使用本地 WASM，失败后尝试 CDN
        const wasmUrls = [
          "/wasm",  // 本地文件
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
          "https://unpkg.com/@mediapipe/tasks-vision@0.10.3/wasm",
        ];
        
        let vision = null;
        for (const url of wasmUrls) {
          try {
            vision = await FilesetResolver.forVisionTasks(url);
            break;
          } catch {
            continue;
          }
        }
        
        if (!vision) {
          throw new Error("WASM load failed");
        }
        if (!isActive) return;

        // 移动端使用 CPU 代理更稳定
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        // 优先使用本地模型
        const modelUrls = [
          "/models/gesture_recognizer.task",  // 本地文件
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        ];
        
        let recognizer = null;
        for (const modelUrl of modelUrls) {
          try {
            recognizer = await GestureRecognizer.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: modelUrl,
                delegate: isMobile ? "CPU" : "GPU"
              },
              runningMode: "VIDEO",
              numHands: 1
            });
            break;
          } catch {
            continue;
          }
        }
        
        if (!recognizer) {
          throw new Error("Model load failed");
        }
        gestureRecognizer = recognizer;
        if (!isActive) return;

        callbacksRef.current.onStatus("REQUESTING CAMERA...");

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const constraints = {
              video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
              audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (!isActive) {
              stream.getTracks().forEach(track => track.stop());
              return;
            }
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
              callbacksRef.current.onStatus("AI READY: SHOW HAND");
              predictWebcam();
            }
          } catch (camErr: any) {
            // 只在首次报错时打印，避免重复日志
            if (camErr.name === 'NotAllowedError') {
              callbacksRef.current.onStatus("CAMERA DENIED");
            } else if (camErr.name === 'NotFoundError') {
              callbacksRef.current.onStatus("NO CAMERA FOUND");
            } else {
              console.error('Camera Error:', camErr);
              callbacksRef.current.onStatus(`CAM ERR: ${camErr.name}`);
            }
            return; // 不再继续尝试
          }
        } else {
          callbacksRef.current.onStatus("CAMERA NOT SUPPORTED");
        }
      } catch (err: any) {
        console.error('AI Setup Error:', err);
        // 更友好的错误提示
        if (err.message?.includes('fetch') || err.message?.includes('network')) {
          callbacksRef.current.onStatus("AI NETWORK ERROR");
        } else if (err.message?.includes('WASM')) {
          callbacksRef.current.onStatus("AI LOAD FAILED");
        } else {
          callbacksRef.current.onStatus(`AI ERROR`);
        }
      }
    };

    const predictWebcam = () => {
      if (gestureRecognizer && videoRef.current && canvasRef.current) {
        if (videoRef.current.videoWidth > 0) {
          const results = gestureRecognizer.recognizeForVideo(videoRef.current, Date.now());
          const ctx = canvasRef.current.getContext("2d");
          const { debugMode: dbg } = callbacksRef.current;

          if (ctx && dbg) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            if (results.landmarks) {
              for (const landmarks of results.landmarks) {
                const drawingUtils = new DrawingUtils(ctx);
                drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FFD700", lineWidth: 2 });
                drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
              }
            }
          } else if (ctx && !dbg) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }

          if (pinchCooldown > 0) pinchCooldown--;

          // 捏合检测 - 需要排除握拳情况
          if (results.landmarks && results.landmarks.length > 0 && pinchCooldown === 0) {
            const landmarks = results.landmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            const ringTip = landmarks[16];
            const pinkyTip = landmarks[20];
            const wrist = landmarks[0];
            
            // 拇指和食指距离
            const dx = thumbTip.x - indexTip.x;
            const dy = thumbTip.y - indexTip.y;
            const pinchDist = Math.sqrt(dx * dx + dy * dy);
            
            // 检查其他手指是否伸展（不是握拳）
            // 握拳时所有手指都弯曲靠近手腕，捏合时其他手指应该伸展
            const middleToWrist = Math.sqrt(
              Math.pow(middleTip.x - wrist.x, 2) + Math.pow(middleTip.y - wrist.y, 2)
            );
            const ringToWrist = Math.sqrt(
              Math.pow(ringTip.x - wrist.x, 2) + Math.pow(ringTip.y - wrist.y, 2)
            );
            const pinkyToWrist = Math.sqrt(
              Math.pow(pinkyTip.x - wrist.x, 2) + Math.pow(pinkyTip.y - wrist.y, 2)
            );
            
            // 其他手指到手腕的平均距离
            const avgFingerDist = (middleToWrist + ringToWrist + pinkyToWrist) / 3;
            
            // 捏合条件：拇指食指靠近 + 其他手指伸展（距离手腕较远）
            const isPinch = pinchDist < 0.08 && avgFingerDist > 0.25;

            if (isPinch) {
              pinchCooldown = 30;
              const pinchX = (thumbTip.x + indexTip.x) / 2;
              const pinchY = (thumbTip.y + indexTip.y) / 2;
              if (callbacksRef.current.onPinch) {
                callbacksRef.current.onPinch({ x: pinchX, y: pinchY });
              }
            }

            if (callbacksRef.current.debugMode) {
              callbacksRef.current.onStatus(`P:${pinchDist.toFixed(2)} F:${avgFingerDist.toFixed(2)}`);
            }
          }

          if (results.gestures.length > 0) {
            const name = results.gestures[0][0].categoryName;
            const score = results.gestures[0][0].score;
            if (score > 0.5) {
              callbacksRef.current.onGesture(name);
              if (callbacksRef.current.debugMode) {
                callbacksRef.current.onStatus(`${name}`);
              }
            }
            if (results.landmarks.length > 0 && !callbacksRef.current.isPhotoSelected) {
              const speed = (0.5 - results.landmarks[0][0].x) * 0.15;
              callbacksRef.current.onMove(Math.abs(speed) > 0.01 ? speed : 0);
            } else if (callbacksRef.current.isPhotoSelected) {
              callbacksRef.current.onMove(0);
            }
          } else {
            callbacksRef.current.onMove(0);
            if (callbacksRef.current.debugMode) {
              callbacksRef.current.onStatus("AI READY: NO HAND");
            }
          }
        }
        requestRef = requestAnimationFrame(predictWebcam);
      }
    };

    setup();

    return () => {
      isActive = false;
      cancelAnimationFrame(requestRef);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [enabled]);

  return (
    <>
      <video
        ref={videoRef}
        style={{
          opacity: debugMode ? 0.6 : 0,
          position: 'fixed',
          top: 0,
          right: 0,
          width: debugMode ? '320px' : '1px',
          zIndex: debugMode ? 100 : -1,
          pointerEvents: 'none',
          transform: 'scaleX(-1)'
        }}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: debugMode ? '320px' : '1px',
          height: debugMode ? 'auto' : '1px',
          zIndex: debugMode ? 101 : -1,
          pointerEvents: 'none',
          transform: 'scaleX(-1)'
        }}
      />
    </>
  );
};
