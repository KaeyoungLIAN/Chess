/**
 * 走棋记录渲染组件
 * 显示棋谱，支持点击跳转（复盘模式），支持每步评估标注
 */

import { Move } from 'chess.js';

export interface StepEval {
  best: string;
  cp: number | null;
  mate: number | null;
  depth: number;
  moves: { move: string; cp: number | null; mate: number | null }[];
}

export function renderMoveHistory(
  container: HTMLElement,
  moves: Move[],
  clickable: boolean = false,
  currentIndex: number = -1,
  onMoveClick?: (index: number) => void,
  evals?: (StepEval | null)[],
) {
  container.innerHTML = '';

  if (moves.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px;">尚无走棋记录</div>';
    return;
  }

  // 建一个 map: 第 N 步后的评估 (入 eval 下标 = 走完 N 步后的局面)
  // 白棋第 0 步前、黑棋第 1 步后，etc
  // 对于当前步 move[i]，评估值显示为走完此步后的局面评估
  const evalMap = evals ?? [];

  for (let i = 0; i < moves.length; i++) {
    const isEven = i % 2 === 0;
    const moveNum = Math.floor(i / 2) + 1;

    if (isEven) {
      const entry = document.createElement('div');
      entry.className = `move-entry ${i === currentIndex ? 'current' : ''}`;

      const numSpan = document.createElement('span');
      numSpan.className = 'move-number';
      numSpan.textContent = `${moveNum}.`;
      entry.appendChild(numSpan);

      // 白棋
      const whiteSpan = document.createElement('span');
      whiteSpan.className = `move-white ${i === currentIndex ? 'current' : ''}`;
      whiteSpan.textContent = moves[i].san;
      if (clickable) {
        whiteSpan.style.cursor = 'pointer';
        whiteSpan.addEventListener('click', () => onMoveClick?.(i));
      }
      entry.appendChild(whiteSpan);

      // 白棋评估
      const wEval = evalMap[i]; // 走完白棋这一步后的局面
      if (wEval) {
        const evalSpan = document.createElement('span');
        evalSpan.className = 'move-eval';
        evalSpan.textContent = formatScore(wEval.cp, wEval.mate);
        entry.appendChild(evalSpan);
      }

      // 黑棋
      const blackSpan = document.createElement('span');
      blackSpan.className = 'move-black';
      if (i + 1 < moves.length) {
        blackSpan.textContent = moves[i + 1].san;
        if (clickable) {
          blackSpan.style.cursor = 'pointer';
          blackSpan.addEventListener('click', () => onMoveClick?.(i + 1));
        }
      }
      entry.appendChild(blackSpan);

      // 黑棋评估 (如果有黑棋这一步)
      if (i + 1 < moves.length) {
        const bEval = evalMap[i + 1]; // 走完黑棋这一步后的局面
        if (bEval) {
          const evalSpan = document.createElement('span');
          evalSpan.className = 'move-eval';
          evalSpan.textContent = formatScore(bEval.cp, bEval.mate);
          entry.appendChild(evalSpan);
        }
      }

      container.appendChild(entry);
    }
  }

  container.scrollTop = container.scrollHeight;
}

function formatScore(cp: number | null, mate: number | null): string {
  if (mate !== null) return `#${Math.abs(mate)}`;
  if (cp !== null) {
    const val = (cp / 100).toFixed(2);
    return cp > 0 ? '+' + val : val;
  }
  return '';
}

export function renderAnalysisMoveHistory(
  container: HTMLElement,
  moves: Move[],
  currentIndex: number,
  onMoveClick: (index: number) => void,
  evals?: (StepEval | null)[],
) {
  renderMoveHistory(container, moves, true, currentIndex, onMoveClick, evals);
}
