# AGENTS.md - Christmas Tree 3D 项目指南

## 项目概述

这是一个基于 **React 18 + Three.js (React Three Fiber)** 的高保真 3D 交互式圣诞树 Web 应用，集成了 **MediaPipe AI 手势识别**功能。用户可以通过手势或按钮控制圣诞树的形态变换（聚合/散开）和视角旋转。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18, TypeScript |
| 构建工具 | Vite 5 |
| 3D 引擎 | React Three Fiber (Three.js 0.169) |
| 3D 工具库 | @react-three/drei, @react-three/postprocessing |
| 数学库 | maath |
| AI 视觉 | @mediapipe/tasks-vision |
| 代码规范 | ESLint, TypeScript-ESLint |

## 项目结构

```
christmas-tree/
├── public/
│   ├── music/            # 音乐资源
│   └── photos/           # 照片资源目录
├── src/
│   ├── components/       # 组件目录
│   │   ├── three/        # 3D 组件
│   │   │   ├── Foliage.tsx          # 树叶粒子系统
│   │   │   ├── PhotoOrnaments.tsx   # 拍立得照片装饰
│   │   │   ├── ChristmasElements.tsx # 圣诞元素
│   │   │   ├── FairyLights.tsx      # 动态彩灯
│   │   │   ├── Snowfall.tsx         # 雪花效果
│   │   │   ├── GiftPile.tsx         # 树底礼物堆
│   │   │   ├── FallingRibbons.tsx   # 飘落丝带
│   │   │   ├── GroundFog.tsx        # 底部雾气
│   │   │   ├── TopStar.tsx          # 树顶金星
│   │   │   └── index.ts             # 导出
│   │   ├── ui/           # UI 组件
│   │   │   ├── SettingsPanel.tsx    # 设置面板
│   │   │   ├── TitleOverlay.tsx     # 标题覆盖层
│   │   │   └── index.ts             # 导出
│   │   ├── Experience.tsx           # 3D 场景容器
│   │   ├── GestureController.tsx    # AI 手势控制器
│   │   └── index.ts                 # 统一导出
│   ├── config/
│   │   └── index.ts      # 视觉配置 (CONFIG)
│   ├── types/
│   │   └── index.ts      # TypeScript 类型定义
│   ├── utils/
│   │   └── helpers.ts    # 工具函数
│   ├── HeartParticles.tsx # 爱心粒子效果
│   ├── TextParticles.tsx  # 文字粒子效果
│   ├── storage.ts        # 分享存储功能
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 应用入口
│   └── index.css         # 全局样式
├── index.html            # HTML 入口
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置
└── package.json          # 依赖配置
```

## 核心架构

### 配置对象 (src/config/index.ts)
集中管理所有视觉参数：颜色、数量、尺寸等。

### 类型定义 (src/types/index.ts)
- `SceneState`: 场景状态 ('CHAOS' | 'FORMED')
- `SceneConfig`: 场景配置接口
- `PhotoScreenPosition`: 照片屏幕位置

### 主要组件

| 组件 | 位置 | 职责 |
|------|------|------|
| `Foliage` | components/three | 树叶粒子系统 (15000+ 粒子) |
| `PhotoOrnaments` | components/three | 拍立得照片装饰，双面渲染 |
| `ChristmasElements` | components/three | 圣诞元素（礼物盒、球、糖果棒） |
| `FairyLights` | components/three | 动态闪烁彩灯 |
| `Snowfall` | components/three | 六角雪花效果 |
| `GiftPile` | components/three | 树底礼物堆 |
| `FallingRibbons` | components/three | 飘落丝带 |
| `GroundFog` | components/three | 底部雾气效果 |
| `TopStar` | components/three | 树顶金色五角星 |
| `Experience` | components | 场景容器，管理相机、灯光、后期处理 |
| `GestureController` | components | AI 手势识别控制器 |
| `SettingsPanel` | components/ui | 设置面板 |
| `TitleOverlay` | components/ui | 顶部艺术字标题 |

### 状态管理 (App.tsx)

- `sceneState`: 控制树的形态
- `rotationSpeed`: 视角旋转速度
- `sceneConfig`: 场景配置
- `aiEnabled`: AI 手势识别开关
- `selectedPhotoIndex`: 选中的照片索引

## 开发指南

### 常用命令

```bash
npm install    # 安装依赖
npm run dev    # 启动开发服务器
npm run build  # 构建生产版本
npm run lint   # 代码检查
npm run preview # 预览构建结果
```

### 添加新 3D 组件

1. 在 `src/components/three/` 创建组件文件
2. 在 `src/components/three/index.ts` 导出
3. 在 `Experience.tsx` 中使用

### 添加新 UI 组件

1. 在 `src/components/ui/` 创建组件文件
2. 在 `src/components/ui/index.ts` 导出
3. 在 `App.tsx` 中使用

### 调整视觉效果

修改 `src/config/index.ts` 中的 CONFIG 对象：
- `counts.foliage`: 树叶粒子数量
- `counts.lights`: 彩灯数量
- `tree.height/radius`: 树的尺寸
- `snow.*`: 雪花参数

## 代码规范

- 使用 TypeScript 严格类型
- 组件使用函数式写法 + Hooks
- 3D 对象使用 `useRef` 引用
- 动画逻辑放在 `useFrame` 中
- 复杂计算使用 `useMemo` 缓存
- 组件按功能分类到对应目录

## 注意事项

1. **摄像头权限**: 手势识别需要摄像头权限
2. **GPU 要求**: 3D 渲染需要较好的 GPU 支持
3. **浏览器兼容**: 推荐使用 Chrome/Edge 最新版本
4. **HTTPS**: 生产环境需要 HTTPS 才能使用摄像头
5. **移动端**: 自动降低粒子数量以提升性能

## 手势支持

| 手势 | 效果 |
|------|------|
| Open_Palm | 散开 (CHAOS) |
| Closed_Fist | 聚合 (FORMED) |
| ILoveYou | 显示爱心粒子 |
| Victory | 显示文字粒子 |
| 捏合 | 选择/取消选择照片 |
