// 视觉配置 - 集中管理所有视觉参数
export const CONFIG = {
  colors: {
    emerald: '#004225',
    gold: '#FFD700',
    silver: '#ECEFF1',
    red: '#D32F2F',
    green: '#2E7D32',
    white: '#FFFFFF',
    warmLight: '#FFD54F',
    lights: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
    borders: ['#FFFAF0', '#F0E68C', '#E6E6FA', '#FFB6C1', '#98FB98', '#87CEFA', '#FFDAB9'],
    giftColors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'],
    candyColors: ['#FF0000', '#FFFFFF']
  },
  counts: {
    foliage: 15000,
    ornaments: 32,
    elements: 500,
    lights: 400,
    snowflakes: 2000
  },
  snow: {
    fallSpeed: { min: 1, max: 3 },
    drift: 0.3,
    size: 0.4,
    opacity: 0.8,
    area: { width: 120, height: 80 },
    wobble: 0.01,
    color: '#ffffff'
  },
  tree: { height: 22, radius: 9 }
};

// 圣诞音乐 URL
export const CHRISTMAS_MUSIC_URL = '/music/mixkit-christmas-stars-866.mp3';
