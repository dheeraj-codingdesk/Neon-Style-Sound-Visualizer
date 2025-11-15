import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface VisualizerData {
  frequencies: Uint8Array;
  waveform: Uint8Array;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  beat: boolean;
}

export const NeonSoundVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationIdRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const prevBarHeightsRef = useRef<number[]>([]);
  const prevWaveRef = useRef<number[]>([]);
  const bassEmaRef = useRef<number>(0);
  const lastBeatTsRef = useRef<number>(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [sourceType, setSourceType] = useState<"mic" | "system" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const initializeMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      setAudioStream(stream);
      
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.9;
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      setSourceType("mic");
      setIsPlaying(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const initializeSystemAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // Some browsers only allow tab audio; prefer current tab when possible
        video: { preferCurrentTab: true } as any,
        audio: true
      } as any);

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No system audio available. Ensure 'Share audio' is enabled.");
      }

      stream.getVideoTracks().forEach(t => t.stop());

      setAudioStream(stream);

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.9;

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      setSourceType("system");
      setIsPlaying(true);
      setErrorMsg("");
    } catch (error) {
      console.error('Error accessing system audio:', error);
      const message =
        (error as any)?.name === 'NotSupportedError'
          ? 'System audio is not supported in this browser or selection. Try sharing a browser tab and enable "Share tab audio" or use Chrome on macOS.'
          : 'Failed to access system audio. Please try again.';
      setErrorMsg(message);
    }
  };

  const stopAudio = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsPlaying(false);
    cancelAnimationFrame(animationIdRef.current);
    setSourceType(null);
    setErrorMsg("");
  };

  const createParticle = (x: number, y: number, intensity: number): Particle => {
    const colors = [
      '#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff0080', '#8000ff'
    ];
    
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * intensity,
      vy: (Math.random() - 0.5) * intensity,
      life: 0,
      maxLife: 60 + Math.random() * 60,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  };

  const updateParticles = () => {
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life++;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      return particle.life < particle.maxLife;
    });
  };

  const drawBars = (ctx: CanvasRenderingContext2D, data: VisualizerData, width: number, height: number) => {
    const barWidth = width / data.frequencies.length;
    const barCount = data.frequencies.length;
    const maxDelta = 8;
    
    for (let i = 0; i < barCount; i++) {
      const targetHeight = (data.frequencies[i] / 255) * height * 0.7;
      if (prevBarHeightsRef.current.length !== barCount) {
        prevBarHeightsRef.current = Array(barCount).fill(0);
      }
      const prev = prevBarHeightsRef.current[i];
      const delta = Math.max(Math.min(targetHeight - prev, maxDelta), -maxDelta);
      const barHeight = prev + delta;
      prevBarHeightsRef.current[i] = barHeight;
      const x = i * barWidth;
      const y = height - barHeight;
      
      const gradient = ctx.createLinearGradient(x, y, x, height);
      const hue = (i / barCount) * 360;
      gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 20%)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
      
      if (data.frequencies[i] > 200) {
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, y, barWidth - 1, barHeight);
        ctx.shadowBlur = 0;
      }
    }
  };

  const drawWaveform = (ctx: CanvasRenderingContext2D, data: VisualizerData, width: number, height: number) => {
    ctx.beginPath();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    
    const sliceWidth = width / data.waveform.length;
    let x = 0;
    const maxDelta = 3;
    if (prevWaveRef.current.length !== data.waveform.length) {
      prevWaveRef.current = Array(data.waveform.length).fill(height / 2);
    }
    
    for (let i = 0; i < data.waveform.length; i++) {
      const v = data.waveform[i] / 128.0;
      const targetY = v * height / 2;
      const prev = prevWaveRef.current[i];
      const delta = Math.max(Math.min(targetY - prev, maxDelta), -maxDelta);
      const y = prev + delta;
      prevWaveRef.current[i] = y;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    particlesRef.current.forEach(particle => {
      const alpha = 1 - (particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
  };

  const analyzeAudio = (): VisualizerData | null => {
    if (!analyserRef.current) return null;
    
    const frequencies = new Uint8Array(analyserRef.current.frequencyBinCount);
    const waveform = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    analyserRef.current.getByteFrequencyData(frequencies);
    analyserRef.current.getByteTimeDomainData(waveform);
    
    const bassRange = frequencies.slice(0, 10);
    const midRange = frequencies.slice(10, 50);
    const trebleRange = frequencies.slice(50, 100);
    
    const bassLevel = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length;
    const midLevel = midRange.reduce((sum, val) => sum + val, 0) / midRange.length;
    const trebleLevel = trebleRange.reduce((sum, val) => sum + val, 0) / trebleRange.length;

    const alpha = 0.2;
    bassEmaRef.current = (1 - alpha) * bassEmaRef.current + alpha * bassLevel;
    const now = performance.now();
    const threshold = 35;
    const minInterval = 180;
    const beat = bassLevel > bassEmaRef.current + threshold && now - lastBeatTsRef.current > minInterval;
    if (beat) lastBeatTsRef.current = now;
    
    return {
      frequencies,
      waveform,
      bassLevel,
      midLevel,
      trebleLevel,
      beat
    };
  };

  const animate = useCallback(() => {
    if (!canvasRef.current || !isPlaying) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);
    
    const data = analyzeAudio();
    if (!data) return;
    
    if (data.beat) {
      for (let i = 0; i < 6; i++) {
        particlesRef.current.push(
          createParticle(width / 2, height / 2, 0.8)
        );
      }
    }
    
    updateParticles();
    drawBars(ctx, data, width, height);
    drawWaveform(ctx, data, width, height);
    drawParticles(ctx, width, height);
    
    animationIdRef.current = requestAnimationFrame(animate);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animate();
    }
    
    return () => {
      cancelAnimationFrame(animationIdRef.current);
    };
  }, [isPlaying, animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    
    const handleResize = () => {
      if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">
          Neon Sound Visualizer
        </h1>
        <p className="text-gray-400 text-center">
          Experience your music with stunning neon visuals
        </p>
      </div>
      
      <div className="relative w-full max-w-4xl h-96 mb-8 rounded-lg overflow-hidden border-2 border-cyan-500 shadow-2xl shadow-cyan-500/50">
        <canvas
          ref={canvasRef}
          className="w-full h-full bg-black"
          style={{ imageRendering: 'crisp-edges' }}
        />
        
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center">
              <div className="text-6xl mb-4">🎵</div>
              <p className="text-white text-lg mb-4">Click start to begin visualizing</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4 items-center justify-center">
        {!isPlaying ? (
          <>
            <button
              onClick={initializeMicrophone}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-cyan-500/50"
            >
              Use Microphone
            </button>
            <button
              onClick={initializeSystemAudio}
              className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-pink-600 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-pink-500/50"
            >
              Use System Audio
            </button>
            {errorMsg && (
              <div className="w-full text-center text-red-400">
                {errorMsg}
              </div>
            )}
          </>
        ) : (
          <button
            onClick={stopAudio}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-red-500/50"
          >
            Stop Visualizer
          </button>
        )}
      </div>
      
      <div className="mt-8 text-center text-gray-500 text-sm max-w-2xl">
        <p>
          Choose an audio source and see dynamic neon bars, waveform, and particles react in real time.
        </p>
        <p className="mt-2">
          For system audio, select a window or screen and enable audio sharing.
        </p>
      </div>
    </div>
  );
};