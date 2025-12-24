
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Experience, GestureController, SettingsPanel, TitleOverlay, Modal, LyricsDisplay, AvatarCropper, IntroOverlay, WelcomeTutorial, PrivacyNotice, CenterPhoto, photoScreenPositions, GiftStepOverlay, VoicePlayer, KeyboardShortcuts, PhotoManager, LetterStepOverlay } from './components';
import { CHRISTMAS_MUSIC_URL } from './config';
import { THEME_PRESETS, type ThemeKey } from './config/themes';
import { isMobile, isTablet, fileToBase64, getDefaultSceneConfig, toggleFullscreen, isFullscreen, isFullscreenSupported } from './utils/helpers';
import { useTimeline } from './hooks/useTimeline';
import { 
  saveLocalConfig, getLocalConfig, saveLocalPhotos, getLocalPhotos
} from './lib/r2';
import type { SceneState, SceneConfig, GestureConfig, GestureAction, MusicConfig } from './types';
import { PRESET_MUSIC } from './types';
import { Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

// 深度合并配置对象
function deepMergeConfig<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        result[key] = deepMergeConfig(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

export default function GrandTreeApp() {
  const mobile = isMobile();
  const isShareMode = false; // TODO: 后续添加路由支持

  // 场景状态
  const [sceneState, setSceneState] = useState<SceneState>('CHAOS');
  
  // 性能优化：rotationSpeed 改为 Ref，避免每帧触发 React 重渲染导致卡顿
  const rotationSpeedRef = useRef(0);
  
  // 性能优化：将 zoomDelta 从 state 改为 ref，避免每帧触发重渲染导致的卡顿
  const zoomRef = useRef<number>(0);
  
  // 使用 ref 存储手掌移动值，避免频繁状态更新导致卡顿
  const palmMoveRef = useRef<{ x: number; y: number } | null>(null);
  const [aiStatus, setAiStatus] = useState("INITIALIZING...");
  const [debugMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [photoLocked, setPhotoLocked] = useState(false); // 照片选中后的锁定期
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // 手势效果状态
  const [showHeart, setShowHeart] = useState(false);
  const [showText, setShowText] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<string>('');
  
  // 爱心特效暂停状态（由 HeartParticles 组件控制）
  const [, setHeartPaused] = useState(false);

  // 头像裁剪状态
  const [avatarToCrop, setAvatarToCrop] = useState<string | null>(null);

  // 开场文案状态
  const [introShown, setIntroShown] = useState(false);

  // 时间轴完成回调
  const handleTimelineComplete = useCallback(() => {
    setSceneState('FORMED');
  }, []);

  // 显示弹窗（提前声明，供 handleFileUpload 使用）
  const showModal = useCallback((
    type: 'alert' | 'confirm' | 'share' | 'error',
    title: string,
    message?: string
  ) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message || '');
    setModalVisible(true);
  }, []);

  // 教程状态 - 默认不显示
  const [showTutorial, setShowTutorial] = useState(false);

  // 隐私政策弹窗
  const [showPrivacy, setShowPrivacy] = useState(false);

  // 快捷键帮助弹窗 - 默认不显示
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textSwitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 照片锁定计时器
  
  // 配置 refs（避免 useCallback 依赖变化导致重新创建）
  const configuredTextsRef = useRef<string[]>([]);
  const textSwitchIntervalRef = useRef<number>(3000);
  const hideTreeConfigRef = useRef<boolean>(true);
  
  // 手势状态 refs
  const lastGestureRef = useRef<string>('');
  const gestureActiveRef = useRef<boolean>(false);

  // 默认手势配置
  const defaultGestures: GestureConfig = {
    Closed_Fist: 'formed',
    Open_Palm: 'chaos',
    Pointing_Up: 'music',
    Thumb_Down: 'zoomOut',
    Thumb_Up: 'zoomIn',
    Victory: 'text',
    ILoveYou: 'heart',
    Pinch: 'none'
  };

  // 默认音乐配置
  const defaultMusic: MusicConfig = {
    selected: 'ren-xing',
    volume: 0.5
  };

  // 场景配置 - 初始化时尝试从本地读取
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(() => {
    const savedConfig = getLocalConfig();
    // 使用统一的默认配置函数（移动端/平板自动使用最低配置）
    const defaultConfig = getDefaultSceneConfig() as unknown as SceneConfig;
    
    if (savedConfig) {
      // 深度合并配置，确保所有字段都有值
      return deepMergeConfig(defaultConfig as unknown as Record<string, unknown>, savedConfig as Record<string, unknown>) as unknown as SceneConfig;
    }
    return defaultConfig;
  });
  
  // 全屏状态
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  
  // 演示模式状态（隐藏鼠标和所有UI）
  const [demoMode, setDemoMode] = useState(false);
  
  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenMode(isFullscreen());
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  // 演示模式键盘监听：D 进入，Esc 退出（基础监听，不依赖其他函数）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入文字，不触发快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // D 键进入演示模式
      if (e.key === 'd' || e.key === 'D') {
        setDemoMode(true);
      }
      // Esc 键退出演示模式 / 关闭弹窗 / 取消选择照片
      if (e.key === 'Escape') {
        setDemoMode(false);
        setShowKeyboardHelp(false);
        setSelectedPhotoIndex(null);
      }
      // ? 键显示快捷键帮助（仅电脑版）
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !mobile) {
        setShowKeyboardHelp(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobile]);
  

  


  // 初始化照片
  const [configLoaded, setConfigLoaded] = useState(false);

  // 是否隐藏圣诞树（显示特效时）
  const [hideTree, setHideTree] = useState(false);

  // 获取已配置的文字列表（使用 useMemo 稳定引用）
  const configuredTexts = useMemo(() => 
    sceneConfig.gestureTexts || 
    (sceneConfig.gestureText ? [sceneConfig.gestureText] : ['MERRY CHRISTMAS']),
    [sceneConfig.gestureTexts, sceneConfig.gestureText]
  );

  // 获取照片轮播间隔配置
  const heartPhotoInterval = (sceneConfig.heartEffect as { photoInterval?: number } | undefined)?.photoInterval || 3000;

  // 获取文字切换间隔（毫秒）
  const textSwitchIntervalMs = (sceneConfig.textSwitchInterval || 3) * 1000;
  
  // 同步配置到 refs（避免 useCallback 依赖变化）
  useEffect(() => {
    configuredTextsRef.current = configuredTexts;
    textSwitchIntervalRef.current = textSwitchIntervalMs;
    hideTreeConfigRef.current = sceneConfig.gestureEffect?.hideTree ?? true;
  }, [configuredTexts, textSwitchIntervalMs, sceneConfig.gestureEffect?.hideTree]);

  // 统一的文字特效控制函数（使用 refs 避免依赖变化）
  // 必须在 timeline useEffect 之前定义
  const startTextEffect = useCallback((duration?: number) => {
    // 清理之前的定时器
    if (textEffectTimerRef.current) {
      clearTimeout(textEffectTimerRef.current);
      textEffectTimerRef.current = null;
    }
    if (textSwitchTimerRef.current) {
      clearInterval(textSwitchTimerRef.current);
      textSwitchTimerRef.current = null;
    }

    const texts = configuredTextsRef.current;
    const switchInterval = textSwitchIntervalRef.current;
    const hideTree = hideTreeConfigRef.current;

    // 重置并显示
    setCurrentTextIndex(0);
    setShowText(true);
    setShowHeart(false);
    if (hideTree) setHideTree(true);

    // 如果有多条文字，启动轮播
    if (texts.length > 1) {
      let idx = 0;
      textSwitchTimerRef.current = setInterval(() => {
        idx = (idx + 1) % texts.length;
        setCurrentTextIndex(idx);
      }, switchInterval);
    }

    // 如果设置了持续时间，启动结束定时器
    if (duration && duration > 0) {
      textEffectTimerRef.current = setTimeout(() => {
        // 内联停止逻辑
        if (textEffectTimerRef.current) {
          clearTimeout(textEffectTimerRef.current);
          textEffectTimerRef.current = null;
        }
        if (textSwitchTimerRef.current) {
          clearInterval(textSwitchTimerRef.current);
          textSwitchTimerRef.current = null;
        }
        setShowText(false);
        setCurrentTextIndex(0);
        if (hideTreeConfigRef.current) setHideTree(false);
        gestureActiveRef.current = false;
      }, duration);
    }
  }, []); // 空依赖数组，函数引用永远不变

  const stopTextEffect = useCallback(() => {
    if (textEffectTimerRef.current) {
      clearTimeout(textEffectTimerRef.current);
      textEffectTimerRef.current = null;
    }
    if (textSwitchTimerRef.current) {
      clearInterval(textSwitchTimerRef.current);
      textSwitchTimerRef.current = null;
    }
    setShowText(false);
    setCurrentTextIndex(0);
    if (hideTreeConfigRef.current) setHideTree(false);
  }, []); // 空依赖数组，函数引用永远不变

  // 时间轴播放器
  const timeline = useTimeline(
    sceneConfig.timeline,
    uploadedPhotos.length,
    handleTimelineComplete,
    configuredTexts,
    heartPhotoInterval
  );

  // 故事线步骤 - 简化版：文字特效只显示第一条，不轮播
  const prevTimelineStepRef = useRef<number>(-1);
  
  useEffect(() => {
    const { isPlaying, currentStep, currentStepIndex } = timeline.state;
    const prevStepIndex = prevTimelineStepRef.current;
    
    // 步骤变化时处理
    if (isPlaying && currentStepIndex !== prevStepIndex) {
      // 文字步骤 - 简化：只显示第一条文字
      if (currentStep?.type === 'text') {
        setCurrentTextIndex(0);
        setShowText(true);
        setShowHeart(false);
        setHideTree(true);
      }
      // 爱心步骤
      else if (currentStep?.type === 'heart') {
        setShowText(false);
        if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current);
        setShowHeart(true);
        setHideTree(true);
      }
      // 礼物步骤 - 隐藏圣诞树，显示礼物盒
      else if (currentStep?.type === 'gift') {
        setShowText(false);
        setShowHeart(false);
        setHideTree(true);
      }
      // 语音步骤 - 隐藏圣诞树
      else if (currentStep?.type === 'voice') {
        setShowText(false);
        setShowHeart(false);
        setHideTree(true);
      }
      // 圣诞树步骤 - 显示圣诞树
      else if (currentStep?.type === 'tree') {
        setShowText(false);
        setShowHeart(false);
        setHideTree(false);
      }
      // 其他步骤（intro/photo）- 隐藏圣诞树
      else {
        setShowText(false);
        setShowHeart(false);
        setHideTree(true);
      }
    }
    
    // 停止播放时清理
    if (!isPlaying && prevStepIndex >= 0) {
      setShowText(false);
      setShowHeart(false);
      setHideTree(false);
    }
    
    prevTimelineStepRef.current = isPlaying ? currentStepIndex : -1;
  }, [timeline.state.isPlaying, timeline.state.currentStepIndex]);

  // 处理图片上传
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 转换为数组，确保移动端兼容性
    const fileArray = Array.from(files);
    console.log(`选择了 ${fileArray.length} 个文件`);
    
    const errors: string[] = [];
    
    // 并行处理所有图片（fileToBase64 内部已包含校验）
    const promises = fileArray.map(async (file) => {
      // 先检查 MIME 类型
      if (!file.type.startsWith('image/')) {
        errors.push(`「${file.name}」不是图片文件`);
        return null;
      }
      
      try {
        const base64 = await fileToBase64(file);
        return { base64, fileName: file.name };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知错误';
        errors.push(`「${file.name}」: ${errorMsg}`);
        console.error('Failed to convert image:', file.name, err);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is { base64: string; fileName: string } => r !== null);
    const newPhotos = validResults.map(r => r.base64);
    
    console.log(`成功处理 ${newPhotos.length} 张图片`);

    // 显示成功提示（如果有成功上传的）
    if (newPhotos.length > 0) {
      setUploadedPhotos(prev => [...prev, ...newPhotos]);
      setRefreshKey(k => k + 1);
      
      // 如果同时有错误，显示部分成功提示
      if (errors.length > 0) {
        const errorText = errors.length === 1 
          ? errors[0] 
          : `${errors.length} 个文件无法加载:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`;
        showModal('error', `成功上传 ${newPhotos.length} 张，${errors.length} 张失败`, errorText);
      }
    } else {
      // 如果全部失败，显示错误提示
      if (errors.length > 0) {
        const errorText = errors.length === 1 
          ? errors[0] 
          : `${errors.length} 个文件无法加载:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...还有 ${errors.length - 5} 个文件失败` : ''}`;
        showModal('error', '图片上传失败', errorText);
      } else {
        // 理论上不应该到这里，但以防万一
        showModal('error', '上传失败', '无法处理选中的文件，请检查文件格式和大小');
      }
    }
    
    // 重置 input，确保下次可以选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [showModal]);

  // 应用预设主题（深度合并，不覆盖照片等用户数据）
  const applyTheme = useCallback((theme: ThemeKey) => {
    const preset = THEME_PRESETS[theme];
    if (!preset) return;
    setSceneConfig((prev) =>
      deepMergeConfig(
        prev as unknown as Record<string, unknown>,
        { ...preset, themeLabel: theme } as unknown as Record<string, unknown>
      ) as unknown as SceneConfig
    );
  }, []);

  // 执行手势动作
  const executeGestureAction = useCallback((action: GestureAction) => {
    const effectConfig = sceneConfig.gestureEffect || {
      duration: 3000,
      hideTree: true,
      textCount: 1000,
      heartCount: 1500
    };
    
    switch (action) {
      case 'formed':
        setSceneState('FORMED');
        break;
      case 'chaos':
        setSceneState('CHAOS');
        break;
      case 'heart':
        if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current);
        setShowHeart(true);
        setShowText(false);
        if (effectConfig.hideTree) setHideTree(true);
        
        // 计算爱心特效持续时间
        const photoInterval = (sceneConfig.heartEffect as { photoInterval?: number } | undefined)?.photoInterval || 3000;
        const photoCount = uploadedPhotos.length || 1;
        // 多张照片时：环绕5秒 + 收缩0.8秒 + 轮播时间
        const hasMultiplePhotos = photoCount > 1;
        const heartDuration = hasMultiplePhotos 
          ? 5000 + 800 + (photoCount * photoInterval) + effectConfig.duration
          : effectConfig.duration + 2000;
        
        heartTimeoutRef.current = setTimeout(() => {
          setShowHeart(false);
          if (effectConfig.hideTree) setHideTree(false);
          gestureActiveRef.current = false; // 效果结束，允许再次触发
        }, heartDuration);
        break;
      case 'text': {
        // 计算总时长：如果有多条文字，至少显示完一轮
        const texts = configuredTextsRef.current;
        const switchInterval = textSwitchIntervalRef.current;
        const totalDuration = texts.length > 1 
          ? Math.max(effectConfig.duration, texts.length * switchInterval)
          : effectConfig.duration;
        startTextEffect(totalDuration);
        break;
      }
      case 'music':
        // 直接操作音频
        if (audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
            setMusicPlaying(true);
          } else {
            audioRef.current.pause();
            setMusicPlaying(false);
          }
        }
        break;
      case 'screenshot':
        // 截图功能
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const link = document.createElement('a');
          link.download = 'christmas-tree.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
        break;
      case 'reset':
        setSceneState('FORMED');
        // 重置旋转速度 - 更新 Ref
        rotationSpeedRef.current = 0;
        // 重置缩放
        zoomRef.current = 0;
        break;
      case 'themeClassic':
        applyTheme('classic');
        break;
      case 'themeIcy':
        applyTheme('icy');
        break;
      case 'themeCandy':
        applyTheme('candy');
        break;
      default:
        break;
    }
  }, [sceneConfig, uploadedPhotos, startTextEffect, applyTheme]);

  // 手动触发特效（按钮触发，支持切换开关）
  const triggerEffect = useCallback((effect: 'heart' | 'text') => {
    // 如果当前特效正在显示，则关闭它
    if (effect === 'heart' && showHeart) {
      setShowHeart(false);
      setHideTree(false);
      setHeartPaused(false);
      if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current);
      return;
    }
    if (effect === 'text' && showText) {
      stopTextEffect();
      return;
    }
    // 否则触发特效
    executeGestureAction(effect);
  }, [showHeart, showText, executeGestureAction, stopTextEffect]);

  // 处理手势变化
  const handleGestureChange = useCallback((gesture: string) => {
    setCurrentGesture(gesture);
    
    const gestures = sceneConfig.gestures || defaultGestures;
    const action = gestures[gesture as keyof GestureConfig];
    
    // 如果是同一个手势且效果正在显示中，不重复触发
    if (gesture === lastGestureRef.current && gestureActiveRef.current) {
      return;
    }
    
    // 如果手势变了，重置状态
    if (gesture !== lastGestureRef.current) {
      gestureActiveRef.current = false;
    }
    
    if (action && action !== 'none') {
      lastGestureRef.current = gesture;
      gestureActiveRef.current = true;
      executeGestureAction(action);
    }
  }, [sceneConfig.gestures, executeGestureAction]);

  // 处理捏合 - 爱心特效时暂停/继续，普通模式选择照片
  const handlePinch = useCallback((_pos: { x: number; y: number }) => {
    // 爱心特效显示时，捏合暂停/继续
    if (showHeart) {
      setHeartPaused(prev => !prev);
      return;
    }
    
    // 锁定期间忽略捏合操作
    if (photoLocked) {
      return;
    }
    
    // 普通模式下的照片选择
    if (selectedPhotoIndex !== null) {
      // 已选中照片时，捏合取消选择
      setSelectedPhotoIndex(null);
    } else {
      // 未选中时，选择最近的照片，并设置距离阈值避免误选
      let closestIndex = -1;
      let closestDist = Infinity;

      photoScreenPositions.forEach((photoPos) => {
        if (photoPos) {
          const dx = photoPos.x - _pos.x;
          const dy = photoPos.y - _pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = photoPos.index;
          }
        }
      });

      // 仅在距离足够近时选中，避免远距离抖动误触
      if (closestIndex >= 0 && closestDist < 0.18) {
        setSelectedPhotoIndex(closestIndex);
        // 启动短锁定期，减少重复触发但保持流畅
        setPhotoLocked(true);
        if (photoLockTimerRef.current) {
          clearTimeout(photoLockTimerRef.current);
        }
        photoLockTimerRef.current = setTimeout(() => {
          setPhotoLocked(false);
        }, 1000); // 锁定1秒
      }
    }
  }, [selectedPhotoIndex, showHeart, photoLocked]);

  // 处理手掌滑动控制视角
  const handlePalmMove = useCallback((deltaX: number, deltaY: number) => {
    // 照片锁定期间禁止相机移动
    if (photoLocked) return;
    // 直接更新 ref，避免触发 React 重新渲染
    palmMoveRef.current = { x: deltaX, y: deltaY };
  }, [photoLocked]);

  // 处理手势缩放 - 使用 Ref 避免 React 重新渲染
  const handleZoom = useCallback((delta: number) => {
    // 照片锁定期间禁止缩放
    if (photoLocked) return;
    // 直接更新 Ref，不触发组件更新
    zoomRef.current = delta;
    
    // 自动回弹/清理 (可选，根据手势控制器的逻辑，如果手势丢失会自动归零)
    // 这里不做自动清理，完全依赖 GestureController 的持续输入
  }, [photoLocked]);
  
  // 处理手势旋转速度控制 - 直接更新 Ref
  const handleRotationSpeedChange = useCallback((speed: number) => {
    rotationSpeedRef.current = speed;
  }, []);

  // 获取当前音乐 URL
  const getMusicUrl = useCallback(() => {
    const musicConfig = sceneConfig.music || defaultMusic;
    if (musicConfig.selected === 'custom' && musicConfig.customUrl) {
      return musicConfig.customUrl;
    }
    const preset = PRESET_MUSIC.find(m => m.id === musicConfig.selected);
    return preset?.url || CHRISTMAS_MUSIC_URL;
  }, [sceneConfig.music]);

  // 获取当前歌词 URL
  const getLrcUrl = useCallback(() => {
    const musicConfig = sceneConfig.music || defaultMusic;
    if (musicConfig.selected === 'custom') {
      return ''; // 自定义音乐暂不支持歌词
    }
    const preset = PRESET_MUSIC.find(m => m.id === musicConfig.selected);
    return preset?.lrc || '';
  }, [sceneConfig.music]);

  // 初始化音频
  useEffect(() => {
    const musicUrl = getMusicUrl();
    const volume = sceneConfig.music?.volume ?? 0.5;
    
    console.log('🎵 初始化音乐:', {
      musicUrl,
      volume,
      selectedMusic: sceneConfig.music?.selected || defaultMusic.selected
    });
    
    audioRef.current = new Audio(musicUrl);
    audioRef.current.loop = true;
    audioRef.current.volume = volume;

    // 添加错误监听
    audioRef.current.addEventListener('error', (e) => {
      console.error('❌ 音乐加载失败:', e);
      console.error('音乐URL:', musicUrl);
    });

    // 添加加载成功监听
    audioRef.current.addEventListener('canplay', () => {
      console.log('✅ 音乐已加载完成，可以播放');
    });

    const playAudio = () => {
      console.log('🎵 尝试播放音乐...');
      audioRef.current?.play()
        .then(() => {
          console.log('✅ 音乐播放成功！');
          setMusicPlaying(true);
        })
        .catch((error) => {
          console.error('❌ 音乐自动播放失败:', error);
          setMusicPlaying(false);
        });
    };
    playAudio();

    const handleInteraction = () => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play()
          .then(() => {
            setMusicPlaying(true);
          })
          .catch(() => {});
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 音量变化时更新（不触发重新加载）
  useEffect(() => {
    if (!audioRef.current) return;
    const volume = sceneConfig.music?.volume ?? 0.5;
    audioRef.current.volume = volume;
  }, [sceneConfig.music?.volume]);

  // 音乐选择变化时重新加载
  useEffect(() => {
    if (!audioRef.current) return;
    
    const musicUrl = getMusicUrl();
    const wasPlaying = !audioRef.current.paused;
    
    // 检查是否需要切换音乐源
    const currentSrc = audioRef.current.src;
    const needsReload = 
      (musicUrl.startsWith('data:') && !currentSrc.startsWith('data:')) ||
      (!musicUrl.startsWith('data:') && !currentSrc.includes(encodeURIComponent(musicUrl.split('/').pop() || '')));
    
    if (needsReload) {
      audioRef.current.src = musicUrl;
      audioRef.current.currentTime = 0;
      if (wasPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [sceneConfig.music?.selected, sceneConfig.music?.customUrl, getMusicUrl]);

  // 播放/暂停音乐
  const toggleMusic = useCallback(() => {
    if (!audioRef.current) return;
    if (musicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
    setMusicPlaying(!musicPlaying);
  }, [musicPlaying]);

  // 时间轴播放时切换音乐
  const previousMusicRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!audioRef.current) return;
    
    const timelineMusic = sceneConfig.timeline?.music;
    const isPlaying = timeline.state.isPlaying;
    
    if (isPlaying && timelineMusic) {
      // 保存当前音乐，开始播放时间轴音乐
      if (previousMusicRef.current === null) {
        previousMusicRef.current = sceneConfig.music?.selected || 'christmas-stars';
      }
      
      const preset = PRESET_MUSIC.find(m => m.id === timelineMusic);
      if (preset && audioRef.current.src !== preset.url) {
        const wasPlaying = !audioRef.current.paused;
        audioRef.current.src = preset.url;
        audioRef.current.currentTime = 0;
        if (wasPlaying) {
          audioRef.current.play().catch(() => {});
        }
      }
    } else if (!isPlaying && previousMusicRef.current !== null) {
      // 停止时恢复原来的音乐
      const preset = PRESET_MUSIC.find(m => m.id === previousMusicRef.current);
      if (preset) {
        const wasPlaying = !audioRef.current.paused;
        audioRef.current.src = preset.url;
        audioRef.current.currentTime = 0;
        if (wasPlaying) {
          audioRef.current.play().catch(() => {});
        }
      }
      previousMusicRef.current = null;
    }
  }, [timeline.state.isPlaying, sceneConfig.timeline?.music, sceneConfig.music?.selected]);

  // 演示模式下的快捷键
  useEffect(() => {
    if (!demoMode) return;
    
    const handleDemoKeyDown = (e: KeyboardEvent) => {
      // 空格键切换聚合/散开
      if (e.key === ' ') {
        e.preventDefault();
        setSceneState(s => s === 'CHAOS' ? 'FORMED' : 'CHAOS');
      }
      // H 键显示爱心
      if (e.key === 'h' || e.key === 'H') {
        triggerEffect('heart');
      }
      // T 键显示文字
      if (e.key === 't' || e.key === 'T') {
        triggerEffect('text');
      }
      // M 键切换音乐
      if (e.key === 'm' || e.key === 'M') {
        toggleMusic();
      }
      // 数字键 1-9 选择照片，0 取消选择
      if (e.key >= '1' && e.key <= '9') {
        const photoIndex = parseInt(e.key) - 1;
        if (photoIndex < uploadedPhotos.length) {
          setSelectedPhotoIndex(photoIndex);
        }
      }
      if (e.key === '0') {
        setSelectedPhotoIndex(null);
      }
      // 左右方向键切换照片
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (uploadedPhotos.length > 0) {
          setSelectedPhotoIndex(prev => {
            if (prev === null) {
              return e.key === 'ArrowRight' ? 0 : uploadedPhotos.length - 1;
            }
            if (e.key === 'ArrowRight') {
              return (prev + 1) % uploadedPhotos.length;
            } else {
              return (prev - 1 + uploadedPhotos.length) % uploadedPhotos.length;
            }
          });
        }
      }
    };
    
    document.addEventListener('keydown', handleDemoKeyDown);
    return () => document.removeEventListener('keydown', handleDemoKeyDown);
  }, [demoMode, triggerEffect, toggleMusic, uploadedPhotos.length]);

  // 分享状态
  // const [isSharing] = useState(false);
  
  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'alert' | 'confirm' | 'share' | 'error'>('alert');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  // const [modalShareUrl, setModalShareUrl] = useState('');
  /*
  const [modalShareInfo, setModalShareInfo] = useState<{
    shareId: string;
    expiresAt: number;
    canEdit: boolean;
    onCopy: () => void;
    onDelete?: () => void;
    onRefresh?: () => void;
  } | undefined>(undefined);
  */


  // 通用快捷键（非演示模式也可用，仅电脑版）
  useEffect(() => {
    if (mobile) return;
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入文字，不触发快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      // 如果有弹窗打开或处于演示模式，不触发（演示模式有自己的快捷键处理）
      if (showSettings || modalVisible || showTutorial || showPrivacy || showKeyboardHelp || showPhotoManager || demoMode) {
        return;
      }
      
      // 空格键切换聚合/散开
      if (e.key === ' ') {
        e.preventDefault();
        setSceneState(s => s === 'CHAOS' ? 'FORMED' : 'CHAOS');
      }
      // R 键重置视角
      if (e.key === 'r' || e.key === 'R') {
        setRefreshKey(k => k + 1);
        rotationSpeedRef.current = 0;
      }
      // F 键全屏切换
      if (e.key === 'f' || e.key === 'F') {
        if (isFullscreenSupported()) {
          toggleFullscreen();
        }
      }
      // M 键切换音乐
      if (e.key === 'm' || e.key === 'M') {
        toggleMusic();
      }
      // H 键显示爱心
      if (e.key === 'h' || e.key === 'H') {
        triggerEffect('heart');
      }
      // T 键显示文字
      if (e.key === 't' || e.key === 'T') {
        triggerEffect('text');
      }
      // S 键打开设置
      if (e.key === 's' || e.key === 'S') {
        setShowSettings(true);
      }
      // P 键播放/停止故事线
      if (e.key === 'p' || e.key === 'P') {
        if (sceneConfig.timeline?.enabled && sceneConfig.timeline.steps.length > 0) {
          if (timeline.state.isPlaying) {
            timeline.actions.stop();
          } else {
            timeline.actions.play();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mobile, showSettings, modalVisible, showTutorial, showPrivacy, showKeyboardHelp, showPhotoManager, demoMode, toggleMusic, triggerEffect, sceneConfig.timeline, timeline.state.isPlaying, timeline.actions]);

  // 加载本地保存的照片（配置已在 useState 初始化时加载）
  useEffect(() => {
    const loadPhotos = async () => {
      console.log('🔍 开始加载照片...');
      const photoUrls: string[] = [];
      const basePath = import.meta.env.BASE_URL;
      // 尝试加载 1.jpg 到 13.jpg（直接从 public/photos 加载）
      for (let i = 1; i <= 13; i++) {
        try {
          const response = await fetch(`${basePath}photos/${i}.jpg`);
          console.log(`📷 尝试加载 ${i}.jpg - 状态: ${response.status}`);
          if (response.ok) {
            const blob = await response.blob();
            console.log(`✅ ${i}.jpg 加载成功, 大小: ${blob.size} bytes`);
            // 直接转换 blob 为 base64，跳过图片校验
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            photoUrls.push(base64);
            console.log(`✨ ${i}.jpg 转换成功`);
          }
        } catch (error) {
          console.error(`❌ 照片 ${i}.jpg 加载失败:`, error);
        }
      }
      
      console.log(`📊 总共加载了 ${photoUrls.length} 张照片`);
      if (photoUrls.length > 0) {
        console.log(`✨ 设置照片到状态...`);
        setUploadedPhotos(photoUrls);
        // 强制保存到 localStorage
        setTimeout(() => {
          saveLocalPhotos(photoUrls);
          console.log('💾 照片已保存到 localStorage');
        }, 1000);
      } else {
        console.warn('⚠️ 没有加载到任何照片，尝试从本地存储读取...');
        // 如果加载失败，尝试从本地存储读取
        const savedPhotos = await getLocalPhotos();
        if (savedPhotos.length > 0) {
          console.log(`📦 从 localStorage 读取到 ${savedPhotos.length} 张照片`);
          setUploadedPhotos(savedPhotos);
        } else {
          // 如果本地存储也没有，加载默认照片（public/photos目录）
          console.log('📷 加载默认照片...');
          const defaultPhotos: string[] = [];
          const basePath = import.meta.env.BASE_URL;
          // 尝试加载 1.jpg 到 13.jpg
          for (let i = 1; i <= 13; i++) {
            try {
              const response = await fetch(`${basePath}photos/${i}.jpg`);
              if (response.ok) {
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                defaultPhotos.push(base64);
              }
            } catch (err) {
              console.log(`照片 ${i}.jpg 不存在，跳过`);
            }
          }
          if (defaultPhotos.length > 0) {
            console.log(`✅ 加载了 ${defaultPhotos.length} 张默认照片`);
            setUploadedPhotos(defaultPhotos);
          }
        }
      }
      setConfigLoaded(true);
    };
    loadPhotos();
  }, []);

  // 配置变化时保存到本地（只在初始加载完成后才保存，避免覆盖）
  useEffect(() => {
    if (configLoaded) {
      saveLocalConfig(sceneConfig as unknown as Record<string, unknown>);
    }
  }, [sceneConfig, configLoaded]);

  // 监听照片数组变化
  useEffect(() => {
    console.log(`🖼️ uploadedPhotos 变化: 现在有 ${uploadedPhotos.length} 张照片`);
    if (uploadedPhotos.length > 0) {
      console.log('📸 照片预览:', uploadedPhotos.map((p, i) => `${i + 1}: ${p.substring(0, 50)}...`));
    }
  }, [uploadedPhotos]);

  // 照片变化时保存到本地
  useEffect(() => {
    if (uploadedPhotos.length > 0) {
      saveLocalPhotos(uploadedPhotos);
    }
  }, [uploadedPhotos]);

  // 分享功能（已禁用）
  /*
  const handleShare = useCallback(async () => {
    if (uploadedPhotos.length === 0) {
      showModal('error', '提示', '请先上传照片');
      return;
    }
    
    setIsSharing(true);
    try {
      const localShare = getLocalShare();
      
      if (localShare) {
        // 已有分享，获取详情并显示弹窗
        const shareData = await getShare(localShare.shareId);
        if (shareData) {
          const shareUrl = getShareUrl(localShare.shareId);
          setModalShareUrl(shareUrl);
          setModalShareInfo({
            shareId: localShare.shareId,
            expiresAt: shareData.expiresAt,
            canEdit: true,
            onCopy: async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                showModal('alert', '已复制', '分享链接已复制到剪贴板');
              } catch {
                // 复制失败时保持弹窗打开
              }
            },
            onRefresh: async () => {
              const result = await refreshShareExpiry(localShare.shareId, localShare.editToken);
              if (result.success) {
                showModal('alert', '续期成功', '分享有效期已延长 7 天');
              } else {
                showModal('error', '续期失败', result.error);
              }
            },
            onDelete: async () => {
              const result = await deleteShare(localShare.shareId, localShare.editToken);
              if (result.success) {
                setModalVisible(false);
                showModal('alert', '已删除', '分享已删除，您可以创建新的分享');
              } else {
                showModal('error', '删除失败', result.error);
              }
            }
          });
          showModal('share', '分享管理', '您已创建过分享，可以更新或管理');
          
          // 同时更新分享内容
          await updateShare(
            localShare.shareId,
            localShare.editToken,
            uploadedPhotos,
            sceneConfig as unknown as Record<string, unknown>,
            sceneConfig.gestureText
          );
        } else {
          // 分享已过期或不存在，清除本地记录
          clearLocalShare();
          showModal('alert', '提示', '之前的分享已过期，请重新创建');
        }
      } else {
        // 创建新分享
        const result = await uploadShare(
          uploadedPhotos,
          sceneConfig as unknown as Record<string, unknown>,
          sceneConfig.gestureText
        );
        
        if (result.success && result.shareId) {
          const shareUrl = getShareUrl(result.shareId);
          const shareData = await getShare(result.shareId);
          
          setModalShareUrl(shareUrl);
          setModalShareInfo({
            shareId: result.shareId,
            expiresAt: shareData?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
            canEdit: true,
            onCopy: async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                showModal('alert', '已复制', '分享链接已复制到剪贴板');
              } catch {
                // 复制失败
              }
            },
            onRefresh: async () => {
              const localShareNow = getLocalShare();
              if (localShareNow) {
                const refreshResult = await refreshShareExpiry(localShareNow.shareId, localShareNow.editToken);
                if (refreshResult.success) {
                  showModal('alert', '续期成功', '分享有效期已延长 7 天');
                } else {
                  showModal('error', '续期失败', refreshResult.error);
                }
              }
            },
            onDelete: async () => {
              const localShareNow = getLocalShare();
              if (localShareNow) {
                const deleteResult = await deleteShare(localShareNow.shareId, localShareNow.editToken);
                if (deleteResult.success) {
                  setModalVisible(false);
                  showModal('alert', '已删除', '分享已删除');
                } else {
                  showModal('error', '删除失败', deleteResult.error);
                }
              }
            }
          });
          showModal('share', '分享成功', '您的圣诞树已分享！');
          
          // 自动复制
          try {
            await navigator.clipboard.writeText(shareUrl);
          } catch {
            // 忽略复制失败
          }
        } else {
          showModal('error', '分享失败', result.error || '请重试');
        }
      }
    } catch (err) {
      showModal('error', '分享失败', '网络错误，请重试');
      console.error(err);
    } finally {
      setIsSharing(false);
    }
  }, [uploadedPhotos, sceneConfig, showModal]);
  */

  // 移除未使用的分享功能
  // const handleShare = ...

  return (
    <div style={{ 
      width: '100vw', 
      height: '100dvh', 
      backgroundColor: '#000', 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      overflow: 'hidden', 
      touchAction: 'none',
      cursor: demoMode ? 'none' : 'auto'
    }}>
      {/* 开场文案 - 时间轴模式下由时间轴控制 */}
      {!sceneConfig.timeline?.enabled && sceneConfig.intro?.enabled && !introShown && (
        <IntroOverlay
          text={sceneConfig.intro.text}
          subText={sceneConfig.intro.subText}
          duration={sceneConfig.intro.duration}
          onComplete={() => setIntroShown(true)}
        />
      )}

      {/* 时间轴模式 - 开场文案 */}
      <IntroOverlay
        text={timeline.introText || ''}
        subText={timeline.introSubText}
        duration={timeline.state.currentStep?.duration || 3000}
        onComplete={() => {}}
        enabled={timeline.showIntro}
      />

      {/* 时间轴模式 - 居中照片展示 */}
      <CenterPhoto
        src={uploadedPhotos[timeline.photoIndex] || ''}
        visible={timeline.showPhoto}
        duration={timeline.state.currentStep?.duration}
      />

      {/* 时间轴模式 - 礼物步骤 */}
      {timeline.showGift && timeline.giftConfig && (
        <GiftStepOverlay
          isWaiting={timeline.isGiftWaiting}
          isOpen={timeline.isGiftOpen}
          message={timeline.giftConfig.message}
          messageDuration={timeline.giftConfig.messageDuration}
          onMessageComplete={timeline.onGiftMessageComplete}
        />
      )}

      {/* 时间轴模式 - 语音步骤 */}
      <VoicePlayer
        audioData={timeline.voiceConfig?.audioData}
        audioUrl={timeline.voiceConfig?.audioUrl}
        visible={timeline.showVoice}
        showIndicator={timeline.voiceConfig?.showIndicator}
        onComplete={timeline.onVoiceComplete}
      />

      {/* 时间轴模式 - 书信步骤 */}
      <LetterStepOverlay
        visible={timeline.showLetter}
        content={timeline.letterConfig?.content || ''}
        speed={timeline.letterConfig?.speed}
        fontSize={timeline.letterConfig?.fontSize}
        color={timeline.letterConfig?.color}
        onComplete={timeline.onLetterComplete}
      />

      {/* 3D Canvas */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <Canvas
          key={refreshKey}
          dpr={mobile ? 1 : isTablet() ? 1.5 : [1, 2]}
          gl={{
            toneMapping: THREE.ReinhardToneMapping,
            antialias: !mobile,
            powerPreference: mobile ? 'low-power' : 'high-performance',
            logarithmicDepthBuffer: true,  // 解决 Z-fighting 问题
            precision: 'highp'
          }}
          shadows={false}
          frameloop="always"
        >
          <Experience
            sceneState={timeline.showTree ? 'FORMED' : sceneState}
            rotationSpeed={rotationSpeedRef} // 传递 Ref 而不是值
            palmMoveRef={palmMoveRef}
            // 传递 zoomRef 而不是 zoomDelta，避免重渲染
            zoomRef={zoomRef}
            config={sceneConfig}
            selectedPhotoIndex={selectedPhotoIndex}
            onPhotoSelect={setSelectedPhotoIndex}
            photoPaths={uploadedPhotos}
            showHeart={showHeart}
            showText={showText}
            customMessage={(sceneConfig.gestureTexts || [sceneConfig.gestureText || 'MERRY CHRISTMAS'])[currentTextIndex] || 'MERRY CHRISTMAS'}
            hideTree={hideTree || timeline.showGift || timeline.showVoice}
            heartCount={sceneConfig.gestureEffect?.heartCount || 1500}
            textCount={sceneConfig.gestureEffect?.textCount || 1000}
            heartCenterPhoto={timeline.heartPhotoIndex !== null ? uploadedPhotos[timeline.heartPhotoIndex] : undefined}
            heartCenterPhotos={uploadedPhotos.length > 0 ? uploadedPhotos : undefined}
            heartPhotoInterval={(sceneConfig.heartEffect as { photoInterval?: number } | undefined)?.photoInterval || 3000}
            onHeartPaused={setHeartPaused}
            showGiftBox={timeline.showGift}
            giftBoxConfig={timeline.giftConfig ? {
              boxColor: timeline.giftConfig.boxColor,
              ribbonColor: timeline.giftConfig.ribbonColor
            } : undefined}
            isGiftWaiting={timeline.isGiftWaiting}
            isGiftOpen={timeline.isGiftOpen}
            onGiftOpen={timeline.onGiftOpen}
          />
        </Canvas>
      </div>

      {/* 手势控制器 */}
      <GestureController
        onGesture={handleGestureChange}
        onMove={handleRotationSpeedChange} // 传递新的处理函数，只更新 Ref
        onStatus={setAiStatus}
        debugMode={debugMode}
        enabled={aiEnabled}
        isPhotoSelected={selectedPhotoIndex !== null}
        photoLocked={photoLocked}
        onPinch={handlePinch}
        onPalmMove={handlePalmMove}
        onZoom={handleZoom} // 现在这个调用不会触发 App 重渲染，只会更新 zoomRef
        palmSpeed={sceneConfig.cameraSensitivity || 25}
        zoomSpeed={sceneConfig.zoomSpeed || 100}
      />


      {/* 设置面板 */}
      {!isShareMode && showSettings && (
        <SettingsPanel
          config={sceneConfig}
          onChange={setSceneConfig}
          onClose={() => setShowSettings(false)}
          aiEnabled={aiEnabled}
          onAiToggle={setAiEnabled}
          onAvatarUpload={(imageUrl) => setAvatarToCrop(imageUrl)}
          photoCount={uploadedPhotos.length}
          photoPaths={uploadedPhotos}
          onTimelinePreview={() => {
            if (timeline.state.isPlaying) {
              timeline.actions.stop();
            } else {
              timeline.actions.play();
            }
          }}
          isTimelinePlaying={timeline.state.isPlaying}
        />
      )}

      {/* 头像裁剪器 */}
      {avatarToCrop && (
        <AvatarCropper
          imageUrl={avatarToCrop}
          onConfirm={(croppedImage) => {
            setSceneConfig(prev => ({ 
              ...prev, 
              topStar: { 
                ...prev.topStar, 
                avatarUrl: croppedImage 
              } 
            }));
            setAvatarToCrop(null);
          }}
          onCancel={() => setAvatarToCrop(null)}
        />
      )}

      {/* 文件上传 */}
      {!isShareMode && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      )}

      {/* 底部按钮 - 演示模式下隐藏 */}
      <div style={{
        position: 'fixed',
        bottom: mobile ? 'max(20px, env(safe-area-inset-bottom))' : '30px',
        right: mobile ? '10px' : '40px',
        left: mobile ? '10px' : 'auto',
        zIndex: 100,
        display: demoMode ? 'none' : 'flex',
        gap: mobile ? '8px' : '10px',
        justifyContent: mobile ? 'center' : 'flex-end',
        flexWrap: 'wrap',
        pointerEvents: 'auto'
      }}>
        <button onClick={toggleMusic} style={buttonStyle(musicPlaying, mobile)}>
          {musicPlaying ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        {/* 全屏按钮 - 移动端/平板显示 */}
        {(mobile || isTablet()) && isFullscreenSupported() && (
          <button 
            onClick={() => toggleFullscreen()} 
            style={buttonStyle(isFullscreenMode, mobile)}
            title={isFullscreenMode ? '退出全屏' : '全屏'}
          >
            {isFullscreenMode ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}

        {!isShareMode && (
          <>
          </>
        )}

        
      </div>

      {/* AI 状态 - 演示模式下隐藏 */}
      {!demoMode && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: aiStatus.includes('ERROR') || aiStatus.includes('DISABLED') ? '#888' : 'rgba(255, 215, 0, 0.4)',
          fontSize: '10px',
          letterSpacing: '2px',
          zIndex: 10,
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          {aiStatus} {currentGesture && `| ${currentGesture}`}
        </div>
      )}

      {/* 标题 - 演示模式下保留标题 */}
      <TitleOverlay 
        text={sceneConfig.title?.text || 'Merry Christmas'} 
        enabled={(sceneConfig.title?.enabled ?? true)} 
        size={sceneConfig.title?.size || 48}
        font={sceneConfig.title?.font || 'Mountains of Christmas'}
        color={sceneConfig.title?.color || '#FFD700'}
        shadowColor={sceneConfig.title?.shadowColor}
      />
      
      {/* 演示模式提示 - 进入时短暂显示 */}
      {demoMode && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255, 215, 0, 0.6)',
          fontSize: '12px',
          fontFamily: 'sans-serif',
          zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          padding: '8px 16px',
          borderRadius: '20px',
          animation: 'fadeOut 3s forwards',
          pointerEvents: 'none'
        }}>
          演示模式 | 空格:聚合/散开 H:爱心 T:文字 M:音乐 1-9:选图 ←→:切换 0:取消 Esc:退出
        </div>
      )}

      {/* 歌词显示 */}
      <LyricsDisplay
        lrcUrl={getLrcUrl()}
        audioRef={audioRef}
        visible={!!getLrcUrl() && (sceneConfig.music?.showLyrics ?? true)}
      />

      {/* 自定义弹窗 */}
      <Modal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
        buttons={modalType === 'alert' || modalType === 'error' ? [
          { text: '确定', onClick: () => setModalVisible(false), primary: true }
        ] : undefined}
      />

      {/* 首次访问教程 */}
      {showTutorial && (
        <WelcomeTutorial onClose={() => setShowTutorial(false)} gestureConfig={sceneConfig.gestures} />
      )}

      {/* 隐私政策 */}
      {showPrivacy && (
        <PrivacyNotice onClose={() => setShowPrivacy(false)} />
      )}

      {/* 快捷键帮助（仅电脑版） */}
      {showKeyboardHelp && !mobile && (
        <KeyboardShortcuts onClose={() => setShowKeyboardHelp(false)} />
      )}

      {/* 照片管理弹窗 */}
      <PhotoManager
        photos={uploadedPhotos}
        onChange={(photos) => {
          setUploadedPhotos(photos);
          setRefreshKey(k => k + 1);
        }}
        isOpen={showPhotoManager}
        onClose={() => setShowPhotoManager(false)}
      />
    </div>
  );
}

// 按钮样式
const buttonStyle = (active: boolean, mobile: boolean): React.CSSProperties => ({
  padding: mobile ? '12px 16px' : '12px 15px',
  backgroundColor: active ? '#FFD700' : 'rgba(0,0,0,0.7)',
  border: '1px solid #FFD700',
  color: active ? '#000' : '#FFD700',
  fontFamily: 'sans-serif',
  fontSize: mobile ? '14px' : '12px',
  fontWeight: 'bold',
  cursor: 'pointer',
  borderRadius: '8px'
});