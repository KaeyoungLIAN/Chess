/**
 * 走棋记录渲染组件
 * 显示棋谱，支持点击跳转（复盘模式）
 */

import { Move } from 'chess.js';

export function renderMoveHistory(
  container: HTMLElement,
  moves: Move[],
  clickable: boolean = false,
  currentIndex: number = -1,
  onMoveClick?: (index: number) => void
) {
  container.innerHTML = '';
  
  if (moves.length === 0) {
    container.innerHTML = '<div style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:20px;">尚无走棋记录</div>';
    return;
  }

  for (let i = 0; i < moves.length; i++) {
    const isEven = i % 2 === 0;
    const moveNum = Math.floor(i / 2) + 1;
    
    if (isEven) {
      // 每两步一行（白+黑）
      const entry = document.createElement('div');
      entry.className = `move-entry ${i === currentIndex ? 'current' : ''}`;
      
      const numSpan = document.createElement('span');
      numSpan.className = 'move-number';
      numSpan.textContent = `${moveNum}.`;
      entry.appendChild(numSpan);
      
      const whiteSpan = document.createElement('span');
      whiteSpan.className = `move-white ${i === currentIndex ? 'current' : ''}`;
      whiteSpan.textContent = moves[i].san;
      if (clickable) {
        whiteSpan.style.cursor = 'pointer';
        whiteSpan.addEventListener('click', () => onMoveClick?.(i));
      }
      entry.appendChild(whiteSpan);
      
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
      
      container.appendChild(entry);
    }
  }
  
  // 如果最后一步是白棋单独一行（没有对应的黑棋）
  if (moves.length % 2 === 1) {
    const moveNum = Math.floor(moves.length / 2) + 1;
    const i = moves.length - 1;
    // 已经被上面的偶数循环包含了
  }
  
  // 滚动到最新
  container.scrollTop = container.scrollHeight;
}

export function renderAnalysisMoveHistory(
  container: HTMLElement,
  moves: Move[],
  currentIndex: number,
  onMoveClick: (index: number) => void
) {
  renderMoveHistory(container, moves, true, currentIndex, onMoveClick);
}
