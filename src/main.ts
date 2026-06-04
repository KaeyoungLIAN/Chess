/**
 * Chess Trainer - 主入口
 */
import './style.css';
import { getEngine } from './engine';
import { AIPlayManager } from './aiPlay';
import { AnalysisManager } from './analysis';

async function init() {
  const overlay = document.getElementById('loading-overlay')!;
  overlay.classList.remove('hidden');

  try {
    const engine = getEngine();
    await engine.init();
    console.log('Stockfish 引擎已就绪');
  } catch (e) {
    console.warn('Stockfish 加载失败，将使用降级模式', e);
    overlay.querySelector('p')!.textContent = '引擎加载失败，AI 将使用简化模式';
    await new Promise(r => setTimeout(r, 1500));
  }

  overlay.classList.add('hidden');

  let aiPlay: AIPlayManager | null = null;
  let analysis: AnalysisManager | null = null;

  // 导航到指定视图
  function navigateTo(view: string) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`)!.classList.add('active');

    if (view === 'ai-play') {
      if (!aiPlay) aiPlay = new AIPlayManager();
    } else if (view === 'analysis') {
      if (!analysis) analysis = new AnalysisManager();
    }
  }

  // 引导卡片点击
  document.getElementById('welcome-ai-play')?.addEventListener('click', () => navigateTo('ai-play'));
  document.getElementById('welcome-analysis')?.addEventListener('click', () => navigateTo('analysis'));
}

init().catch(console.error);
