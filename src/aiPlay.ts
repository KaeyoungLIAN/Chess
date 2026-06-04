/**
 * AI 对战模式
 * 人机对战 UI 逻辑，难度控制，执棋选择
 */

import { Chess, type Square, type Move } from 'chess.js';
import { ChessBoard } from './board';
import { getEngine } from './engine';
import { renderMoveHistory } from './moveHistory';

type PlayerColor = 'w' | 'b';
type GamePhase = 'idle' | 'player_turn' | 'ai_thinking' | 'game_over';

export class AIPlayManager {
  private chess: Chess;
  private board: ChessBoard;
  private playerColor: PlayerColor = 'w';
  private aiColor: PlayerColor = 'b';
  private difficulty: number = 5;
  private phase: GamePhase = 'idle';
  private selectedSquare: Square | null = null;
  private moveHistory: Move[] = [];
  private flipped: boolean = false;
  
  // DOM 引用
  private moveListEl: HTMLElement;
  private statusEl: HTMLElement;
  private difficultySlider: HTMLInputElement;
  private difficultyLabel: HTMLElement;
  
  constructor() {
    this.chess = new Chess();
    
    this.board = new ChessBoard({
      id: 'chess-board',
      orientation: 'white',
      onSquareClick: (sq) => this.handleSquareClick(sq),
    });

    this.moveListEl = document.getElementById('move-list')!;
    this.statusEl = document.getElementById('status-text')!;
    this.difficultySlider = document.getElementById('difficulty-slider') as HTMLInputElement;
    this.difficultyLabel = document.getElementById('difficulty-label')!;
    
    this.bindControls();
    this.startNewGame();
  }

  private bindControls() {
    // 难度滑块
    this.difficultySlider.addEventListener('input', () => {
      this.difficulty = parseInt(this.difficultySlider.value);
      this.difficultyLabel.textContent = `Lv. ${this.difficulty}`;
    });

    // 执棋选择
    document.querySelectorAll('#color-white, #color-black, #color-random').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-selector .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 新对局
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      const colorId = document.querySelector('.color-selector .btn.active')?.id;
      let playerColor: PlayerColor = 'w';
      if (colorId === 'color-black') playerColor = 'b';
      else if (colorId === 'color-random') playerColor = Math.random() > 0.5 ? 'w' : 'b';
      else playerColor = 'w';
      
      this.setPlayerColor(playerColor);
      this.startNewGame();
    });

    // 悔棋
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      this.undoMove();
    });

    // 翻转棋盘
    document.getElementById('btn-flip-board')?.addEventListener('click', () => {
      this.flipped = !this.flipped;
      this.board.setOrientation(this.flipped ? 'black' : 'white');
      this.render();
    });
  }

  setPlayerColor(color: PlayerColor) {
    this.playerColor = color;
    this.aiColor = color === 'w' ? 'b' : 'w';
  }

  async startNewGame() {
    // 停止 AI 计算
    const engine = getEngine();
    if (engine.isThinking()) engine.stop();
    
    this.chess = new Chess();
    this.selectedSquare = null;
    this.phase = 'idle';
    this.moveHistory = [];
    this.board.clearSelection();
    this.board.clearLastMove();
    this.board.clearHighlights();
    
    // 设置朝向
    this.board.setOrientation(this.flipped ? (this.playerColor === 'w' ? 'black' : 'white') : (this.playerColor === 'w' ? 'white' : 'black'));
    
    this.render();
    this.updateStatus('准备开始');
    
    // 如果 AI 执白，AI 先手
    if (this.aiColor === 'w') {
      await this.aiMove();
    } else {
      this.phase = 'player_turn';
      this.updateStatus('轮到你了（白棋）');
    }
  }

  private async handleSquareClick(sq: Square) {
    if (this.phase !== 'player_turn') return;
    
    const piece = this.chess.get(sq);
    
    // 如果点击了自己的棋子，选中它
    if (piece && piece.color === this.playerColor) {
      this.selectedSquare = sq;
      const moves = this.chess.moves({ square: sq, verbose: true });
      const legalSquares = moves.map(m => m.to as Square);
      this.board.setSelected(sq, legalSquares);
      this.render();
      return;
    }
    
    // 如果已有选中棋子，尝试走棋
    if (this.selectedSquare) {
      try {
        const move = this.chess.move({
          from: this.selectedSquare,
          to: sq,
          promotion: 'q' // 默认升变为后
        });
        
        if (move) {
          this.moveHistory.push(move);
          this.selectedSquare = null;
          this.board.clearSelection();
          this.board.setLastMove(move.from as Square, move.to as Square);
          this.render();
          
          // 检查游戏是否结束
          if (this.isGameOver()) return;
          
          // AI 走棋
          this.phase = 'ai_thinking';
          this.updateStatus('AI 思考中...');
          await this.aiMove();
        }
      } catch {
        // 非法走法，取消选中
        this.selectedSquare = null;
        this.board.clearSelection();
        this.render();
      }
    }
  }

  private async aiMove() {
    const engine = getEngine();
    if (!engine.isReady()) {
      this.updateStatus('引擎未就绪');
      return;
    }

    // 设置 AI 思考时间：根据难度调整
    // 低难度快着走，高难度多思考
    const thinkTime = 200 + this.difficulty * 200;

    try {
      // 获取当前局面 FEN + 历史走法（UCI 格式）
      const moves = this.chess.history({ verbose: false });
      
      // Stockfish 需要 UCI 格式走法
      // 从开局走法开始
      if (moves.length > 0) {
        engine.setStartPosition(moves);
      } else {
        engine.setStartPosition();
      }
      
      const evals = await engine.calculateBestMove(this.difficulty, thinkTime);
      
      if (evals.length > 0 && evals[0].move) {
        const uciMove = evals[0].move;
        // uciMove 格式如 "e2e4" 或 "e7e8q"
        const from = uciMove.substring(0, 2) as Square;
        const to = uciMove.substring(2, 4) as Square;
        const promotion = uciMove.length > 4 ? uciMove[4] as 'q' | 'r' | 'b' | 'n' : undefined;
        
        try {
          const move = this.chess.move({ from, to, promotion });
          if (move) {
            this.moveHistory.push(move);
            this.board.setLastMove(from, to);
            this.render();
            
            if (this.isGameOver()) return;
            
            this.phase = 'player_turn';
            const colorName = this.playerColor === 'w' ? '白棋' : '黑棋';
            this.updateStatus(`轮到你了（${colorName}）`);
          }
        } catch (e) {
          console.warn('AI 走法无效，使用 chess.js 内部 AI', e);
          // 降级：用 chess.js 的随机走法
          this.fallbackAIMove();
        }
      } else {
        this.fallbackAIMove();
      }
    } catch (e) {
      console.error('AI 走棋失败', e);
      this.fallbackAIMove();
    }
  }

  private fallbackAIMove() {
    // 降级方案：从 chess.js 选一个合法走法
    const moves = this.chess.moves({ verbose: true });
    if (moves.length > 0) {
      // 选一个较优的走法（优先吃子）
      const captures = moves.filter(m => m.flags.includes('c'));
      const chosen = captures.length > 0 
        ? captures[Math.floor(Math.random() * captures.length)]
        : moves[Math.floor(Math.random() * Math.min(moves.length, 3))];
      
      try {
        const move = this.chess.move(chosen.san);
        if (move) {
          this.moveHistory.push(move);
          this.board.setLastMove(move.from as Square, move.to as Square);
          this.render();
          if (this.isGameOver()) return;
        }
      } catch {}
    }
    
    this.phase = 'player_turn';
    const colorName = this.playerColor === 'w' ? '白棋' : '黑棋';
    this.updateStatus(`轮到你了（${colorName}）`);
  }

  private isGameOver(): boolean {
    if (this.chess.isGameOver()) {
      this.phase = 'game_over';
      
      if (this.chess.isCheckmate()) {
        const winner = this.chess.turn() === 'w' ? '黑棋' : '白棋';
        this.updateStatus(`将杀！${winner}胜`);
      } else if (this.chess.isDraw()) {
        if (this.chess.isStalemate()) this.updateStatus('逼和（无子可走）');
        else if (this.chess.isThreefoldRepetition()) this.updateStatus('和棋（三次重复）');
        else if (this.chess.isInsufficientMaterial()) this.updateStatus('和棋（子力不足）');
        else this.updateStatus('和棋');
      }
      
      this.render();
      return true;
    }
    return false;
  }

  private undoMove() {
    if (this.phase === 'ai_thinking') return;
    
    // 撤回两步（玩家和 AI 各一步）
    if (this.moveHistory.length >= 2) {
      this.chess.undo();
      this.chess.undo();
      this.moveHistory.splice(this.moveHistory.length - 2, 2);
    } else if (this.moveHistory.length === 1) {
      this.chess.undo();
      this.moveHistory.pop();
    } else {
      return;
    }
    
    this.selectedSquare = null;
    this.board.clearSelection();
    
    // 更新上一步高亮
    if (this.moveHistory.length > 0) {
      const last = this.moveHistory[this.moveHistory.length - 1];
      this.board.setLastMove(last.from as Square, last.to as Square);
    } else {
      this.board.clearLastMove();
    }
    
    this.render();
    this.phase = 'player_turn';
    this.updateStatus('已悔棋，继续下');
  }

  private render() {
    this.board.render(this.chess);
    this.renderMoveList();
  }

  private renderMoveList() {
    renderMoveHistory(this.moveListEl, this.moveHistory, false);
  }

  private updateStatus(msg: string) {
    this.statusEl.textContent = msg;
  }
}
