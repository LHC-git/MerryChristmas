import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecorded: (audioBlob: Blob) => void;
  maxDuration?: number; // 最大时长（秒），默认 60
  onCancel?: () => void;
}

export const VoiceRecorder = ({
  onRecorded,
  maxDuration = 60,
  onCancel
}: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // 清理资源
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);
  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // 开始录制
  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // 选择支持的格式
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // 停止所有轨道
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100); // 每 100ms 收集一次数据
      setIsRecording(true);
      setRecordingTime(0);
      
      // 计时器
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
      
    } catch (err) {
      console.error('录音失败:', err);
      setError('无法访问麦克风，请检查权限设置');
    }
  };
  
  // 停止录制
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };
  
  // 重新录制
  const resetRecording = () => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };
  
  // 确认使用
  const confirmRecording = () => {
    if (audioBlob) {
      onRecorded(audioBlob);
    }
  };
  
  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '12px',
      color: '#fff',
      minWidth: '300px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>
        🎤 语音祝福
      </h3>
      
      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: 'rgba(255, 0, 0, 0.2)',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
      
      {/* 录制状态 */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <div style={{
          fontSize: '48px',
          fontWeight: 'bold',
          color: isRecording ? '#FF4444' : '#FFD700'
        }}>
          {formatTime(recordingTime)}
        </div>
        <div style={{ fontSize: '14px', color: '#888' }}>
          最长 {maxDuration} 秒
        </div>
        
        {/* 录制波形指示 */}
        {isRecording && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '4px',
            marginTop: '10px'
          }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: '4px',
                  height: '20px',
                  backgroundColor: '#FF4444',
                  borderRadius: '2px',
                  animation: `wave 0.5s ease-in-out ${i * 0.1}s infinite alternate`
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 预览播放 */}
      {audioUrl && !isRecording && (
        <div style={{ marginBottom: '20px' }}>
          <audio 
            src={audioUrl} 
            controls 
            style={{ width: '100%' }}
          />
        </div>
      )}
      
      {/* 按钮 */}
      <div style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center'
      }}>
        {!audioUrl && !isRecording && (
          <button
            onClick={startRecording}
            style={{
              padding: '12px 24px',
              backgroundColor: '#FF4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            🎙️ 开始录制
          </button>
        )}
        
        {isRecording && (
          <button
            onClick={stopRecording}
            style={{
              padding: '12px 24px',
              backgroundColor: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            ⏹️ 停止录制
          </button>
        )}
        
        {audioUrl && !isRecording && (
          <>
            <button
              onClick={resetRecording}
              style={{
                padding: '12px 24px',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              🔄 重新录制
            </button>
            <button
              onClick={confirmRecording}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ✅ 使用
            </button>
          </>
        )}
        
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#888',
              border: '1px solid #888',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        )}
      </div>
      
      {/* 动画样式 */}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.5); }
          to { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
};
