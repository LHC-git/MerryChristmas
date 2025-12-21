import { useState, useEffect } from 'react';

interface GiftStepOverlayProps {
  isWaiting: boolean;
  isOpen: boolean;
  message: string;
  messageDuration?: number;
  onMessageComplete?: () => void;
}

export const GiftStepOverlay = ({
  isWaiting,
  isOpen,
  message,
  messageDuration = 3000,
  onMessageComplete
}: GiftStepOverlayProps) => {
  const [showMessage, setShowMessage] = useState(false);
  const [messageOpacity, setMessageOpacity] = useState(0);
  
  // 打开后显示祝福语
  useEffect(() => {
    if (isOpen && !showMessage) {
      // 延迟显示祝福语（等待开盒动画）
      const showTimer = setTimeout(() => {
        setShowMessage(true);
        setMessageOpacity(1);
      }, 500);
      
      return () => clearTimeout(showTimer);
    }
  }, [isOpen, showMessage]);
  
  // 祝福语显示完毕后回调
  useEffect(() => {
    if (showMessage) {
      const fadeTimer = setTimeout(() => {
        setMessageOpacity(0);
      }, messageDuration - 500);
      
      const completeTimer = setTimeout(() => {
        onMessageComplete?.();
      }, messageDuration);
      
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [showMessage, messageDuration, onMessageComplete]);
  
  return (
    <>
      {/* 点击提示 */}
      {isWaiting && !isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#FFD700',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
            animation: 'pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 100
          }}
        >
          👆 点击礼物盒打开
        </div>
      )}
      
      {/* 祝福语 */}
      {showMessage && (
        <div
          style={{
            position: 'fixed',
            top: '30%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#FFFFFF',
            fontSize: '2rem',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4)',
            opacity: messageOpacity,
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: 'none',
            zIndex: 100,
            maxWidth: '80%',
            lineHeight: 1.5
          }}
        >
          {message}
        </div>
      )}
      
      {/* 动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
        }
      `}</style>
    </>
  );
};
