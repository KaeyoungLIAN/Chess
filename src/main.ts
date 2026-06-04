/**
 * Chess Trainer - 主入口
 * 国际象棋自学网站
 */

import './style.css';
import { getEngine } from './engine';
import { AIPlayManager } from './aiPlay';
import { AnalysisManager } from './analysis';

// 初始化
async function init() {
  // 显示加载遮罩
  const overlay = document.getElementById('loading-overlay')!;
  overlay.classList.remove('hidden');

  try {
    // 加载引擎
    const engine = getEngine();
    await engine.init();
    console.log('Stockfish 引擎已就绪');
  } catch (e) {
    console.warn('Stockfish WASM 加载失败，将使用降级模式', e);
    overlay.querySelector('p')!.textContent = '引擎加载失败，AI 将使用简化模式';
    await new Promise(r => setTimeout(r, 1500));
  }

  // 隐藏加载遮罩
  overlay.classList.add('hidden');

  // 初始化管理模式
  let aiPlay: AIPlayManager | null = null;
  let analysis: AnalysisManager | null = null;
  
  // 标签切换
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const view = (btn as HTMLElement).dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      
      if (view === 'ai-play') {
        document.getElementById('view-ai-play')!.classList.add('active');
        if (!aiPlay) {
          aiPlay = new AIPlayManager();
        }
      } else if (view === 'analysis') {
        document.getElementById('view-analysis')!.classList.add('active');
        if (!analysis) {
          analysis = new AnalysisManager();
        }
      }
    });
  });

  // 初始状态：AI 对战
  aiPlay = new AIPlayManager();
}

init().catch(console.error);
