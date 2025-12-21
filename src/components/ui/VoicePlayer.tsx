/**
 * 语音播放器组件
 * 用于在故事线中播放语音祝福
 */
import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

interface VoicePlayerProps {
  audioData?: string;  // Base64 音频数据
  audioUrl?: string;   // 音频 URL
  visible: boolean;
  showIndicator?: boolean;
  onComplete?: () => void;
}

export const VoicePlayer = ({
  audioData,
  audioUrl,
  visible,
  showIndicator = true,
  onComplete
}: VoicePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!visible) {
      // 停止播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    // 获取音频源
    const src = audioData || audioUrl;
    if (!src) {
      // 没有音频，直接完成
      onComplete?.();
      return;
    }

    // 创建或更新音频元素
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    audio.src = src;

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    const handleError = () => {
      console.error('Voice playback error');
      setIsPlaying(false);
      onComplete?.();
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // 开始播放
    audio.play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.error('Voice play failed:', err);
        onComplete?.();
      });

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [visible, audioData, audioUrl, onComplete]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!visible || !showIndicator || !isPlaying) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '120px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#00BCD4',
      padding: '12px 24px',
      borderRadius: '30px',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: 200,
      boxShadow: '0 4px 20px rgba(0, 188, 212, 0.3)',
      border: '1px solid rgba(0, 188, 212, 0.4)'
    }}>
      <Volume2 size={20} className="pulse" />
      <span>正在播放语音祝福...</span>
      
      {/* 音频波形动画 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        marginLeft: '8px'
      }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: '16px',
              backgroundColor: '#00BCD4',
              borderRadius: '2px',
              animation: `voiceWave 0.6s ease-in-out ${i * 0.1}s infinite alternate`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes voiceWave {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
        .pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
