/**
 * 复盘分析模式
 * 导入 .pgn 棋局，逐步行进，引擎分析
 */

import { Chess, type Square, type Move } from 'chess.js';
import { ChessBoard } from './board';
import { getEngine } from './engine';
import { renderAnalysisMoveHistory } from './moveHistory';
import type { EvalResult } from './engine';

type AnalysisPhase = 'idle' | 'loaded' | 'analyzing' | 'done';

export class AnalysisManager {
  private chess: Chess;
  private board: ChessBoard;
  private moves: Move[] = [];
  private currentIndex: number = -1; // -1 = 初始局面
  private phase: AnalysisPhase = 'idle';
  
  // DOM
  private pgnInput: HTMLTextAreaElement;
  private moveListEl: HTMLElement;
  private moveCounterEl: HTMLElement;
  private engineOutputEl: HTMLElement;
  
  constructor() {
    this.chess = new Chess();
    
    this.board = new ChessBoard({
      id: 'analysis-board',
      orientation: 'white',
      onSquareClick: () => {}, // 复盘模式只读，不点击走棋
    });
    
    this.pgnInput = document.getElementById('pgn-input') as HTMLTextAreaElement;
    this.moveListEl = document.getElementById('analysis-move-list')!;
    this.moveCounterEl = document.getElementById('move-counter')!;
    this.engineOutputEl = document.getElementById('analysis-engine-output')!;
    
    this.bindControls();
    this.render();
  }

  private bindControls() {
    // 导入 PGN
    document.getElementById('btn-load-pgn')?.addEventListener('click', () => {
      this.loadPGN();
    });

    // 空棋盘示例
    (document.querySelector('#pgn-input + .btn-secondary') as HTMLElement)?.addEventListener('click', () => {
      this.pgnInput.value = EXAMPLE_PGN;
      this.loadPGN();
    });

    // 导航控制
    document.getElementById('btn-first')?.addEventListener('click', () => this.goToMove(-1));
    document.getElementById('btn-prev')?.addEventListener('click', () => this.goToMove(this.currentIndex - 1));
    document.getElementById('btn-next')?.addEventListener('click', () => this.goToMove(this.currentIndex + 1));
    document.getElementById('btn-last')?.addEventListener('click', () => this.goToMove(this.moves.length - 1));
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (this.phase === 'idle') return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        this.goToMove(this.currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goToMove(this.currentIndex - 1);
      }
    });

    // 引擎分析
    document.getElementById('btn-engine-eval')?.addEventListener('click', () => {
      this.analyzeCurrentPosition();
    });
  }

  private loadPGN() {
    const pgn = this.pgnInput.value.trim();
    if (!pgn) {
      this.showEngineOutput('<div style="color:var(--danger);">请输入 PGN 棋局</div>');
      return;
    }

    try {
      const tempChess = new Chess();
      tempChess.loadPgn(pgn);
      this.moves = tempChess.history({ verbose: true });
      
      if (this.moves.length === 0) {
        this.showEngineOutput('<div style="color:var(--danger);">PGN 解析成功但没有走棋记录</div>');
        return;
      }
      
      // 重置
      this.chess = new Chess();
      this.currentIndex = -1;
      this.phase = 'loaded';
      
      this.render();
      this.showEngineOutput(`<div style="color:var(--success);">已加载 ${this.moves.length} 步棋</div>`);
      this.updateMoveCounter();
      this.renderMoveList();
      
    } catch (e) {
      this.showEngineOutput(`<div style="color:var(--danger);">PGN 解析失败: ${(e as Error).message}</div>`);
    }
  }

  private goToMove(targetIndex: number) {
    if (this.phase === 'analyzing') return;
    
    // 限制范围
    targetIndex = Math.max(-1, Math.min(this.moves.length - 1, targetIndex));
    if (targetIndex === this.currentIndex) return;
    
    this.currentIndex = targetIndex;
    
    // 从初始局面开始重放
    this.chess = new Chess();
    for (let i = 0; i <= this.currentIndex; i++) {
      try {
        this.chess.move(this.moves[i].san);
      } catch {
        break;
      }
    }
    
    this.board.clearHighlights();
    this.render();
    this.updateMoveCounter();
    this.renderMoveList();
    this.engineOutputEl.innerHTML = '';
  }

  private async analyzeCurrentPosition() {
    const engine = getEngine();
    if (!engine.isReady()) {
      this.showEngineOutput('<div style="color:var(--warning);">引擎未就绪，请稍后重试</div>');
      return;
    }
    
    if (this.chess.isGameOver()) {
      this.showEngineOutput('<div style="color:var(--text-secondary);">对局已结束，无法分析</div>');
      return;
    }

    this.phase = 'analyzing';
    this.showEngineOutput('<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto 8px;"></div><div style="text-align:center;color:var(--text-secondary);">引擎分析中...</div>');

    try {
      const fen = this.chess.fen();
      const moves = this.chess.history({ verbose: false });
      
      if (moves.length > 0) {
        engine.setStartPosition(moves);
      } else {
        engine.setStartPosition();
      }
      
      const evals = await engine.analyzePosition(10, 2000);
      
      if (evals.length > 0) {
        // 取第一个评估
        const mainEval = evals[0];
        const isWhiteTurn = this.chess.turn() === 'w';
        const scoreCP = mainEval.score !== null ? (isWhiteTurn ? mainEval.score : -mainEval.score) : null;
        
        // 评估显示
        let evalStr = '';
        if (mainEval.mate !== null) {
          const mateIn = Math.abs(mainEval.mate);
          evalStr = `#${mateIn}`;
        } else if (scoreCP !== null) {
          evalStr = `${(scoreCP / 100).toFixed(2)}`;
        }
        
        let html = `
          <div class="eval-bar ${scoreCP !== null && scoreCP >= 0 ? 'eval-positive' : 'eval-negative'}">
            局面评估: ${evalStr}
            ${scoreCP !== null ? `<span style="font-size:0.7rem;color:var(--text-secondary);margin-left:8px;">深度 ${mainEval.depth}</span>` : ''}
          </div>
        `;
        
        // 最佳走法
        if (mainEval.move) {
          const from = mainEval.move.substring(0, 2);
          const to = mainEval.move.substring(2, 4);
          html += `<div class="eval-best">✅ 最佳走法: ${mainEval.move}</div>`;
          
          // 高亮最佳走法的格子
          this.board.setHighlights([from as Square, to as Square]);
          this.render();
        }
        
        // 多走法对比（如果有）
        if (evals.length >= 2) {
          const currentEval = evals[0];
          // 计算当前走法与最佳的差距
          html += '<div style="margin-top:8px;font-weight:600;font-size:0.8rem;color:var(--text-secondary);">备选走法:</div>';
          
          for (let i = 0; i < Math.min(evals.length, 3); i++) {
            const e = evals[i];
            const eScore = this.chess.turn() === 'w' ? (e.score ?? 0) : -(e.score ?? 0);
            const loss = currentEval.score !== null && e.score !== null 
              ? currentEval.score - e.score 
              : 0;
            
            if (e.move) {
              html += `<div style="font-size:0.75rem;padding:2px 0;">
                <span class="${i === 0 ? 'eval-best' : ''}">${e.move}</span>
                <span style="color:var(--text-secondary);margin-left:6px;">
                  ${e.mate !== null ? `#${e.mate}` : (e.score !== null ? `${(eScore / 100).toFixed(2)}` : '')}
                  ${i > 0 && loss > 50 ? `<span class="eval-mistake"> (亏 ${(loss / 100).toFixed(2)})</span>` : ''}
                </span>
              </div>`;
            }
          }
        }
        
        this.showEngineOutput(html);
      } else {
        this.showEngineOutput('<div style="color:var(--warning);">引擎未返回分析结果</div>');
      }
    } catch (e) {
      this.showEngineOutput(`<div style="color:var(--danger);">分析失败: ${(e as Error).message}</div>`);
    }
    
    this.phase = 'loaded';
  }

  private render() {
    this.board.render(this.chess);
  }

  private updateMoveCounter() {
    this.moveCounterEl.textContent = `${this.currentIndex + 1} / ${this.moves.length}`;
  }

  private renderMoveList() {
    renderAnalysisMoveHistory(this.moveListEl, this.moves, this.currentIndex, (idx) => {
      this.goToMove(idx);
    });
  }

  private showEngineOutput(html: string) {
    this.engineOutputEl.innerHTML = html;
  }
}

const EXAMPLE_PGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Nc6 14. Nb3 Nxd4 15. Nfxd4 exd4 16. Qxd4 Bd7 17. Bg5 Rfe8 18. Rae1 d5 19. e5 Bc6 20. Qd3 g6 21. Bf6 Bd6 22. Bxe8 Rxe8 23. Qxd5 Bxe5 24. Qxe5 Rxe5 25. Rxe5 Qb7 26. Rxb5 Qxe5 27. Rxa6 Qe2 28. Rb6 Qxf2+ 29. Kh1 Qg1+ 30. Rxg1 Nf2+ 31. Kh2`;
