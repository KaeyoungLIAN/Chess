/**
 * Chess Trainer - 主入口
 */
import './style.css';
import { getEngine } from './engine';
import { AIPlayManager } from './aiPlay';
import { AnalysisManager } from './analysis';
import { TutorialManager } from './tutorial';

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
  let tutorial: TutorialManager | null = null;

  // 导航到指定视图
  function navigateTo(view: string) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`)!.classList.add('active');

    if (view === 'ai-play') {
      if (!aiPlay) aiPlay = new AIPlayManager();
    } else if (view === 'analysis') {
      if (!analysis) analysis = new AnalysisManager();
    } else if (view === 'tutorial') {
      if (!tutorial) tutorial = new TutorialManager();
    }
  }

  // 引导卡片点击
  document.getElementById('welcome-ai-play')?.addEventListener('click', () => navigateTo('ai-play'));
  document.getElementById('welcome-analysis')?.addEventListener('click', () => navigateTo('analysis'));
  document.getElementById('welcome-tutorial')?.addEventListener('click', () => navigateTo('tutorial'));
  document.getElementById('welcome-puzzle')?.addEventListener('click', () => navigateTo('puzzle'));

  // 返回首页按钮（统一 class back-home-btn）
  document.querySelectorAll('.back-home-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // 如果 AI 对战视图开着且不在配置面板，先回配置
      const viewAiPlay = document.getElementById('view-ai-play');
      if (viewAiPlay && viewAiPlay.classList.contains('active')) {
        const setupPanel = document.getElementById('panel-setup');
        if (setupPanel && setupPanel.classList.contains('hidden')) {
          document.getElementById('btn-back-to-setup')?.click();
        }
      }
      navigateTo('welcome');
    });
  });

  // 教程侧边导航切换
  document.querySelectorAll('.tutorial-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.tutorial-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const chapter = (item as HTMLElement).dataset.chapter;
      document.querySelectorAll('.tutorial-chapter').forEach(c => c.classList.remove('active'));
      const target = document.getElementById(`chapter-${chapter}`);
      if (target) target.classList.add('active');
    });
  });

  // 教程演示按钮
  document.querySelectorAll('.tut-show-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const demo = (btn as HTMLElement).dataset.demo;
      if (demo) {
        if (!tutorial) tutorial = new TutorialManager();
        tutorial.renderDemo(demo);
      }
    });
  });

  // 教程棋盘步进控制
  document.getElementById('tut-step-back')?.addEventListener('click', () => {
    tutorial?.stepBackward();
  });
  document.getElementById('tut-step-fwd')?.addEventListener('click', () => {
    tutorial?.stepForward();
  });
}

init().catch(console.error);
