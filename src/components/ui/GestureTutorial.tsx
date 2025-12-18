import { useState, useEffect } from 'react';
import { X, Hand, Grab, Heart, Sparkles } from 'lucide-react';

interface GestureTutorialProps {
  onClose: () => void;
}

const gestures = [
  { icon: Hand, name: '张开手掌', action: '散开圣诞树', color: '#4FC3F7' },
  { icon: Grab, name: '握拳', action: '聚合圣诞树', color: '#81C784' },
  { icon: Heart, name: '我爱你手势', action: '显示爱心特效', color: '#F48FB1' },
  { icon: Sparkles, name: '剪刀手', action: '显示文字特效', color: '#FFD54F' },
];

export const GestureTutorial = ({ onClose }: GestureTutorialProps) => {
  const [visible, setVisible] = useState(true);

  // 5秒后自动隐藏
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: `translateX(-50%) ${visible ? 'translateY(0)' : 'translateY(20px)'}`,
        zIndex: 200,
        background: 'rgba(0, 0, 0, 0.9)',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        borderRadius: '12px',
        padding: '16px 20px',
        maxWidth: '340px',
        width: '90%',
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Hand size={16} /> 手势控制教程
        </span>
        <button
          onClick={handleClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {gestures.map((gesture, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
            }}
          >
            <gesture.icon size={20} style={{ color: gesture.color, flexShrink: 0 }} />
            <div style={{ fontSize: '11px' }}>
              <div style={{ color: '#fff', fontWeight: 500 }}>{gesture.name}</div>
              <div style={{ color: '#888' }}>{gesture.action}</div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '10px', color: '#666', margin: '10px 0 0 0', textAlign: 'center' }}>
        需要摄像头权限 · 8秒后自动关闭
      </p>
    </div>
  );
};
