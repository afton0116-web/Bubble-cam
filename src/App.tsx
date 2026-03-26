/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// --- Bubble Physics Class ---
class Bubble {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  opacity: number;
  hue: number;
  phase: number;
  amplitude: number;
  frequency: number;
  
  isSelected: boolean = false;
  isCaptured: boolean = false;
  capturedImage: HTMLImageElement | null = null;
  facingMode: 'user' | 'environment' = 'environment';
  isDragging: boolean = false;

  constructor(x: number, y: number, radius: number) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = -Math.random() * 2 - 1;
    this.opacity = 0.6;
    this.hue = Math.random() * 60 + 240;
    this.phase = Math.random() * Math.PI * 2;
    this.amplitude = Math.random() * 2 + 1;
    this.frequency = Math.random() * 0.02 + 0.01;
  }

  update(width: number, height: number) {
    if (this.isCaptured || this.isDragging) return;

    this.phase += this.frequency;
    const wobble = Math.sin(this.phase) * this.amplitude;
    
    this.x += this.vx + wobble;
    this.y += this.vy;

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -1;
    } else if (this.x + this.radius > width) {
      this.x = width - this.radius;
      this.vx *= -1;
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy *= -1;
    } else if (this.y + this.radius > height) {
      this.y = height - this.radius;
      this.vy *= -1;
    }
  }

  draw(ctx: CanvasRenderingContext2D, userVideo: HTMLVideoElement | null, envVideo: HTMLVideoElement | null) {
    ctx.save();
    
    // 1. Draw Selection Glow (Breathing effect)
    if (this.isSelected) {
      const glowIntensity = (Math.sin(Date.now() / 300) + 1) / 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
      ctx.shadowBlur = 15 + glowIntensity * 10;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + glowIntensity * 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const contentRadius = this.radius * 0.82;

    // 2. Clip for internal content
    ctx.beginPath();
    ctx.arc(this.x, this.y, contentRadius, 0, Math.PI * 2);
    ctx.clip();

    // 3. Draw Camera Stream or Captured Image
    ctx.globalAlpha = 1.0; // Use mask for precise alpha control
    
    if (this.isCaptured && this.capturedImage) {
      ctx.drawImage(this.capturedImage, this.x - contentRadius, this.y - contentRadius, contentRadius * 2, contentRadius * 2);
    } else {
      let video = this.facingMode === 'user' ? userVideo : envVideo;
      
      // Fallback: If the preferred video isn't ready, try the other one
      if (!video || video.readyState < 2) {
        video = (envVideo && envVideo.readyState >= 2) ? envVideo : userVideo;
      }

      if (video && video.readyState >= 2) {
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        const vAspectRatio = vWidth / vHeight;
        
        let drawWidth = contentRadius * 2;
        let drawHeight = contentRadius * 2;
        
        if (vAspectRatio > 1) {
          drawWidth = drawHeight * vAspectRatio;
        } else {
          drawHeight = drawWidth / vAspectRatio;
        }

        ctx.save();
        // Mirror if using user camera
        if (this.facingMode === 'user') {
          ctx.translate(this.x + drawWidth / 2, this.y - drawHeight / 2);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
        } else {
          ctx.drawImage(
            video,
            this.x - drawWidth / 2,
            this.y - drawHeight / 2,
            drawWidth,
            drawHeight
          );
        }
        ctx.restore();
      }
    }

    // 3.5 Apply Radial Transparency Mask (Center 0.9, Edge 0.7)
    const maskGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, contentRadius);
    maskGrad.addColorStop(0, 'rgba(0,0,0,0.9)');    // Center: Mostly opaque
    maskGrad.addColorStop(0.7, 'rgba(0,0,0,0.8)');  // Mid: Slight fade
    maskGrad.addColorStop(1, 'rgba(0,0,0,0.7)');    // Edge: Slightly more transparent
    
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = maskGrad;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0; // Reset alpha for overlay

    // Capture Flash Effect
    if (this.isCaptured && !this.capturedImage) {
      // Temporary flash while loading image
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    }

    // 4. Draw Rainbow Edge & Highlights (Overlay)
    ctx.restore();
    ctx.save();
    
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
    gradient.addColorStop(0.8, `rgba(255, 255, 255, 0.05)`);
    gradient.addColorStop(0.85, `rgba(179, 136, 235, ${this.opacity * 0.4})`);
    gradient.addColorStop(0.90, `rgba(128, 147, 241, ${this.opacity * 0.5})`);
    gradient.addColorStop(0.94, `rgba(114, 239, 221, ${this.opacity * 0.6})`);
    gradient.addColorStop(0.97, `rgba(247, 208, 138, ${this.opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(243, 145, 169, ${this.opacity * 0.3})`);

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
    ctx.stroke();

    const hX = this.x - this.radius * 0.45;
    const hY = this.y - this.radius * 0.45;
    const hR = this.radius * 0.2;
    const hGrad = ctx.createRadialGradient(hX, hY, 0, hX, hY, hR);
    hGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    hGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.beginPath();
    ctx.ellipse(hX, hY, hR, hR * 0.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = hGrad;
    ctx.fill();

    ctx.restore();
  }
}

// --- Audio Utility ---
const playPopSound = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [envStream, setEnvStream] = useState<MediaStream | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [isBackgroundFrozen, setIsBackgroundFrozen] = useState(false);
  const [frozenBackgroundUrl, setFrozenBackgroundUrl] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const envVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const pressStartTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number>(0);
  const dragTargetRef = useRef<Bubble | null>(null);

  // --- Camera Logic ---
  const stopStream = (stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      // Stop existing streams to avoid conflicts on mobile
      stopStream(userStream);
      stopStream(envStream);
      setUserStream(null);
      setEnvStream(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      
      if (mode === 'user') {
        setUserStream(stream);
      } else {
        setEnvStream(stream);
      }
      return stream;
    } catch (err) {
      console.warn(`Could not access ${mode} camera:`, err);
      return null;
    }
  };

  const handleStart = async () => {
    setIsStarted(true);
    // On mobile, only start one camera at a time to avoid conflicts
    await startCamera('environment');
  };

  const toggleGlobalCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  // Sync streams to video elements
  useEffect(() => {
    if (userVideoRef.current && userStream) {
      userVideoRef.current.srcObject = userStream;
      userVideoRef.current.play().catch(() => {});
    }
  }, [userStream]);

  useEffect(() => {
    if (envVideoRef.current && envStream) {
      envVideoRef.current.srcObject = envStream;
      envVideoRef.current.play().catch(() => {});
    }
  }, [envStream]);

  useEffect(() => {
    if (videoRef.current) {
      const activeStream = facingMode === 'user' ? userStream : envStream;
      // Fallback if the preferred stream isn't available
      videoRef.current.srcObject = activeStream || envStream || userStream;
      videoRef.current.play().catch(() => {});
    }
  }, [facingMode, userStream, envStream]);

  // --- Bubble Interaction ---
  const handlePressStart = () => {
    pressStartTimeRef.current = Date.now();
    setIsPressing(true);
  };

  const handlePressEnd = () => {
    if (pressStartTimeRef.current === null) return;
    const duration = Date.now() - pressStartTimeRef.current;
    pressStartTimeRef.current = null;
    setIsPressing(false);
    const radius = Math.min(200, 40 + (duration / 2000) * 160);
    const spawnX = window.innerWidth / 2;
    const spawnY = window.innerHeight * 0.85;
    const newBubble = new Bubble(spawnX, spawnY, radius);
    newBubble.facingMode = facingMode; // Inherit current global mode
    bubblesRef.current.push(newBubble);
    playPopSound();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find bubble under pointer (topmost first)
    let found: Bubble | null = null;
    for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
      const b = bubblesRef.current[i];
      const dist = Math.sqrt((x - b.x) ** 2 + (y - b.y) ** 2);
      if (dist < b.radius) {
        found = b;
        break;
      }
    }

    // Update selection
    bubblesRef.current.forEach(b => b.isSelected = b.id === found?.id);
    setSelectedBubbleId(found?.id || null);

    if (found) {
      found.isDragging = true;
      dragTargetRef.current = found;
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent | React.MouseEvent) => {
    if (dragTargetRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragTargetRef.current.x = e.clientX - rect.left;
      dragTargetRef.current.y = e.clientY - rect.top;
    }
  };

  const handleCanvasPointerUp = () => {
    if (dragTargetRef.current) {
      dragTargetRef.current.isDragging = false;
      dragTargetRef.current = null;
    }
  };

  // --- Action Handlers ---
  const handleBubbleSwitch = async () => {
    const bubble = bubblesRef.current.find(b => b.id === selectedBubbleId);
    if (bubble && !bubble.isCaptured) {
      const nextMode = bubble.facingMode === 'user' ? 'environment' : 'user';
      bubble.facingMode = nextMode;
      // If the bubble's mode is different from global, we might need to switch global too or just handle it
      // For simplicity, let's keep global synced if it's the selected bubble
      setFacingMode(nextMode);
      await startCamera(nextMode);
    }
  };

  const handleBubbleCapture = () => {
    const bubble = bubblesRef.current.find(b => b.id === selectedBubbleId);
    if (bubble && !bubble.isCaptured) {
      const video = bubble.facingMode === 'user' ? userVideoRef.current : envVideoRef.current;
      if (!video || video.readyState < 2) return;

      // Visual feedback
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);

      const tempCanvas = document.createElement('canvas');
      const size = bubble.radius * 2;
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tCtx = tempCanvas.getContext('2d');
      if (!tCtx) return;

      // Apply Dreamy Filter
      tCtx.filter = 'blur(1px) brightness(1.1) saturate(1.1)';
      
      // Draw centered video frame
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const vAspectRatio = vWidth / vHeight;
      let drawWidth = size;
      let drawHeight = size;
      if (vAspectRatio > 1) drawWidth = drawHeight * vAspectRatio;
      else drawHeight = drawWidth / vAspectRatio;

      tCtx.drawImage(video, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);

      const img = new Image();
      bubble.isCaptured = true; // Set immediately to show flash/loading state
      img.src = tempCanvas.toDataURL('image/png');
      img.onload = () => {
        bubble.capturedImage = img;
      };
    }
  };

  const handleBubbleDelete = () => {
    bubblesRef.current = bubblesRef.current.filter(b => b.id !== selectedBubbleId);
    setSelectedBubbleId(null);
  };

  const handleBackgroundFreeze = () => {
    if (isBackgroundFrozen) {
      setIsBackgroundFrozen(false);
      setFrozenBackgroundUrl(null);
    } else {
      const video = videoRef.current;
      if (!video) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        // Mirror if user camera
        if (facingMode === 'user') {
          tCtx.translate(tempCanvas.width, 0);
          tCtx.scale(-1, 1);
        }
        tCtx.drawImage(video, 0, 0);
        setFrozenBackgroundUrl(tempCanvas.toDataURL('image/jpeg', 0.9));
        setIsBackgroundFrozen(true);
      }
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = window.innerWidth;
    exportCanvas.height = window.innerHeight;
    const eCtx = exportCanvas.getContext('2d');
    if (!eCtx) return;

    const finalizeDownload = () => {
      eCtx.drawImage(canvas, 0, 0);
      const link = document.createElement('a');
      link.download = `dreamy-bubble-${Date.now()}.jpg`;
      link.href = exportCanvas.toDataURL('image/jpeg', 0.9);
      link.click();
    };

    // 1. Draw Background
    if (isBackgroundFrozen && frozenBackgroundUrl) {
      const img = new Image();
      img.src = frozenBackgroundUrl;
      img.onload = () => {
        const imgRatio = img.width / img.height;
        const screenRatio = window.innerWidth / window.innerHeight;
        let dW, dH, dX, dY;
        if (imgRatio > screenRatio) {
          dH = exportCanvas.height;
          dW = dH * imgRatio;
          dX = (exportCanvas.width - dW) / 2;
          dY = 0;
        } else {
          dW = exportCanvas.width;
          dH = dW / imgRatio;
          dX = 0;
          dY = (exportCanvas.height - dH) / 2;
        }
        eCtx.drawImage(img, dX, dY, dW, dH);
        finalizeDownload();
      };
    } else if (video) {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const vRatio = vWidth / vHeight;
      const sRatio = window.innerWidth / window.innerHeight;
      let dW, dH, dX, dY;
      if (vRatio > sRatio) {
        dH = exportCanvas.height;
        dW = dH * vRatio;
        dX = (exportCanvas.width - dW) / 2;
        dY = 0;
      } else {
        dW = exportCanvas.width;
        dH = dW / vRatio;
        dX = 0;
        dY = (exportCanvas.height - dH) / 2;
      }
      
      eCtx.save();
      if (facingMode === 'user') {
        eCtx.translate(exportCanvas.width, 0);
        eCtx.scale(-1, 1);
      }
      eCtx.drawImage(video, dX, dY, dW, dH);
      eCtx.restore();
      finalizeDownload();
    }
  };

  // --- Animation Loop ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bubblesRef.current.forEach(bubble => {
      bubble.update(canvas.width, canvas.height);
      bubble.draw(ctx, userVideoRef.current, envVideoRef.current);
    });

    if (pressStartTimeRef.current !== null) {
      const duration = Date.now() - pressStartTimeRef.current;
      const radius = Math.min(200, 40 + (duration / 2000) * 160);
      const spawnX = canvas.width / 2;
      const spawnY = canvas.height * 0.85;
      const preview = new Bubble(spawnX, spawnY, radius);
      preview.opacity = 0.4;
      preview.facingMode = facingMode;
      preview.draw(ctx, userVideoRef.current, envVideoRef.current);
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [facingMode]);

  useEffect(() => {
    if (isStarted) requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isStarted, animate]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className="relative w-full h-screen overflow-hidden text-[#5A5A7A]">
      {/* Background Video */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isStarted ? 'opacity-100' : 'opacity-0'} ${isBackgroundFrozen ? 'hidden' : 'block'} ${facingMode === 'user' ? '-scale-x-100' : ''}`}
      />

      {/* Frozen Background Image */}
      {isBackgroundFrozen && frozenBackgroundUrl && (
        <img 
          src={frozenBackgroundUrl} 
          alt="Frozen Background"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Hidden Helper Videos for Internal Bubble Streams */}
      <video 
        ref={userVideoRef} 
        autoPlay playsInline muted 
        style={{ position: 'absolute', opacity: 0.01, pointerEvents: 'none', width: '10px', height: '10px', top: 0, left: 0 }} 
      />
      <video 
        ref={envVideoRef} 
        autoPlay playsInline muted 
        style={{ position: 'absolute', opacity: 0.01, pointerEvents: 'none', width: '10px', height: '10px', top: 0, left: 0 }} 
      />

      {/* Bubble Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
        className="absolute inset-0 z-10 cursor-crosshair"
      />

      {/* Flash Effect Overlay */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isStarted ? (
          <motion.section
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#FFD1FF]/30 backdrop-blur-sm"
          >
            <h1 className="text-2xl md:text-5xl font-serif-slender font-light mb-12 tracking-widest text-center whitespace-nowrap px-4">
              Breathe life into bubbles
            </h1>
            <button
              onClick={handleStart}
              className="glass-morphism px-10 py-4 rounded-full text-sm ui-label hover:bg-white/30 transition-all active:scale-95"
            >
              点击拍摄
            </button>
          </motion.section>
        ) : (
          <motion.section
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 flex flex-col z-20 pointer-events-none"
          >
            <div className="flex-1 relative" />

            <div className="h-[20%] w-full flex items-center justify-center px-4 pb-8">
              <div className="glass-morphism w-full max-w-5xl h-24 rounded-3xl flex items-center justify-around px-2 md:px-6 gap-1 md:gap-4 pointer-events-auto">
                <ActionButton 
                  label="泡泡拍摄" 
                  onClick={handleBubbleCapture}
                  disabled={!selectedBubbleId}
                />
                <ActionButton 
                  label="泡泡切换" 
                  onClick={handleBubbleSwitch}
                  disabled={!selectedBubbleId}
                />
                <ActionButton 
                  label="泡泡删除" 
                  onClick={handleBubbleDelete}
                  disabled={!selectedBubbleId}
                />
                
                <div className="relative -top-4">
                  <button 
                    onPointerDown={handlePressStart}
                    onPointerUp={handlePressEnd}
                    className="glass-morphism rainbow-border w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-sm md:text-lg ui-label shadow-xl hover:scale-105 transition-transform active:scale-95 select-none touch-none"
                  >
                    吹泡泡
                  </button>
                </div>

                <ActionButton 
                  label={isBackgroundFrozen ? "恢复背景" : "背景定格"} 
                  onClick={handleBackgroundFreeze} 
                />
                <ActionButton label="背景切换" onClick={toggleGlobalCamera} />
                <ActionButton label="照片下载" onClick={handleDownload} />
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 h-12 md:h-14 glass-morphism rounded-xl text-[11px] md:text-[13px] ui-label hover:bg-white/30 transition-all active:scale-95 flex items-center justify-center text-center px-1 leading-tight break-words ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
}
