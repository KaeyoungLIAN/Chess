/**
 * AI 对战模式
 * 操作流：配置(难度/执棋) → 开始对局 → 对局中(走棋/悔棋/认输) → 结束
 */

import { Chess, type Square, type Move } from 'chess.js';
import { ChessBoard } from './board';
import { getEngine } from './engine';
import { renderMoveHistory } from './moveHistory';

type PlayerColor = 'w' | 'b';
type GamePhase = 'setup' | 'player_turn' | 'ai_thinking' | 'game_over';

export class AIPlayManager {
  private chess: Chess;
  private board: ChessBoard;
  private playerColor: PlayerColor = 'w';
  private aiColor: PlayerColor = 'b';
  private difficulty: number = 5;
  private phase: GamePhase = 'setup';
  private selectedSquare: Square | null = null;
  private moveHistory: Move[] = [];
  private flipped: boolean = false;

  // 面板 DOM
  private panelSetup: HTMLElement;
  private panelGame: HTMLElement;

  // 控制 DOM
  private moveListEl: HTMLElement;
  private statusEl: HTMLElement;
  private difficultySlider: HTMLInputElement;
  private difficultyLabel: HTMLElement;
  private gameInfoDifficulty: HTMLElement;
  private gameInfoTurn: HTMLElement;
  private btnUndo: HTMLButtonElement;
  private btnStart: HTMLButtonElement;
  private btnDownloadPgn: HTMLButtonElement;

  constructor() {
    this.chess = new Chess();

    this.board = new ChessBoard({
      id: 'chess-board',
      orientation: 'white',
      onSquareClick: (sq) => this.handleSquareClick(sq),
    });

    this.panelSetup = document.getElementById('panel-setup')!;
    this.panelGame = document.getElementById('panel-game')!;
    this.moveListEl = document.getElementById('move-list')!;
    this.statusEl = document.getElementById('status-text')!;
    this.difficultySlider = document.getElementById('difficulty-slider') as HTMLInputElement;
    this.difficultyLabel = document.getElementById('difficulty-label')!;
    this.gameInfoDifficulty = document.getElementById('game-info-difficulty')!;
    this.gameInfoTurn = document.getElementById('game-info-turn')!;
    this.btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
    this.btnStart = document.getElementById('btn-start-game') as HTMLButtonElement;
    this.btnDownloadPgn = document.getElementById('btn-download-pgn') as HTMLButtonElement;

    this.bindControls();
    this.showSetupPanel();
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

    // 开始对局
    this.btnStart.addEventListener('click', () => {
      const colorId = document.querySelector('.color-selector .btn.active')?.id;
      let playerColor: PlayerColor = 'w';
      if (colorId === 'color-black') playerColor = 'b';
      else if (colorId === 'color-random') playerColor = Math.random() > 0.5 ? 'w' : 'b';
      else playerColor = 'w';

      this.setPlayerColor(playerColor);
      this.startNewGame();
    });

    // 悔棋
    this.btnUndo.addEventListener('click', () => {
      this.undoMove();
    });

    // 翻转棋盘
    document.getElementById('btn-flip-board')?.addEventListener('click', () => {
      this.flipped = !this.flipped;
      this.board.setOrientation(this.flipped ? 'black' : 'white');
      this.render();
    });

    // 认输
    document.getElementById('btn-resign')?.addEventListener('click', () => {
      if (this.phase === 'setup' || this.phase === 'game_over') return;
      this.phase = 'game_over';
      const winner = this.playerColor === 'w' ? '黑棋' : '白棋';
      this.updateStatus(`你认输了，${winner}胜`);
      this.showGameOverState();
    });

    // 下载 PGN
    this.btnDownloadPgn.addEventListener('click', () => {
      this.downloadPgn();
    });

    // 返回设置
    document.getElementById('btn-back-to-setup')?.addEventListener('click', () => {
      if (this.phase === 'ai_thinking') return;
      this.cleanupGame();
      this.showSetupPanel();
    });
  }

  private showSetupPanel() {
    this.panelSetup.classList.remove('hidden');
    this.panelGame.classList.add('hidden');
    this.btnDownloadPgn.classList.add('hidden');
    this.updateStatus('设置好难度和执棋，点击开始');
    this.difficultySlider.disabled = false;
  }

  private showGamePanel() {
    this.panelSetup.classList.add('hidden');
    this.panelGame.classList.remove('hidden');
    this.difficultySlider.disabled = true;
  }

  private showGameOverState() {
    this.btnUndo.disabled = true;
    this.btnDownloadPgn.classList.remove('hidden');
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
    this.phase = 'player_turn';
    this.moveHistory = [];
    this.board.clearSelection();
    this.board.clearLastMove();
    this.board.clearHighlights();
    this.btnUndo.disabled = false;

    // 设置朝向
    this.board.setOrientation(
      this.flipped
        ? (this.playerColor === 'w' ? 'black' : 'white')
        : (this.playerColor === 'w' ? 'white' : 'black')
    );

    this.showGamePanel();
    this.gameInfoDifficulty.textContent = `Lv. ${this.difficulty}`;
    this.render();

    // 如果 AI 执白，AI 先手
    if (this.aiColor === 'w') {
      this.updateStatus('AI 思考中...');
      this.gameInfoTurn.textContent = 'AI 思考';
      this.btnUndo.disabled = true;
      await this.aiMove();
    } else {
      this.updateStatus(`轮到你了（白棋）`);
      this.gameInfoTurn.textContent = '白棋走';
    }
  }

  private async handleSquareClick(sq: Square) {
    if (this.phase !== 'player_turn') return;

    const piece = this.chess.get(sq);

    // 点击自己的棋子 → 选中
    if (piece && piece.color === this.playerColor) {
      this.selectedSquare = sq;
      const moves = this.chess.moves({ square: sq, verbose: true });
      const legalSquares = moves.map(m => m.to as Square);
      this.board.setSelected(sq, legalSquares);
      this.render();
      return;
    }

    // 已有选中棋子 → 尝试走棋
    if (this.selectedSquare) {
      try {
        const move = this.chess.move({
          from: this.selectedSquare,
          to: sq,
          promotion: 'q',
        });

        if (move) {
          this.moveHistory.push(move);
          this.selectedSquare = null;
          this.board.clearSelection();
          this.board.setLastMove(move.from as Square, move.to as Square);
          this.render();

          if (this.isGameOver()) return;

          // AI 走棋
          this.phase = 'ai_thinking';
          this.btnUndo.disabled = true;
          this.updateStatus('AI 思考中...');
          this.gameInfoTurn.textContent = 'AI 思考';
          await this.aiMove();
        }
      } catch {
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
      this.gameInfoTurn.textContent = '引擎异常';
      return;
    }

    const thinkTime = 200 + this.difficulty * 200;

    try {
      const moves = this.chess.history({ verbose: false });

      if (moves.length > 0) {
        engine.setStartPosition(moves);
      } else {
        engine.setStartPosition();
      }

      const evals = await engine.calculateBestMove(this.difficulty, thinkTime);

      if (evals.length > 0 && evals[0].move) {
        const uciMove = evals[0].move;
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
            this.btnUndo.disabled = false;
            const colorName = this.playerColor === 'w' ? '白棋' : '黑棋';
            this.updateStatus(`轮到你了（${colorName}）`);
            this.gameInfoTurn.textContent = `${colorName}走`;
            return;
          }
        } catch {
          // AI 走法无效，降级
        }
      }

      // 降级
      this.fallbackAIMove();
    } catch {
      this.fallbackAIMove();
    }
  }

  private fallbackAIMove() {
    const moves = this.chess.moves({ verbose: true });
    if (moves.length > 0) {
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
    this.btnUndo.disabled = false;
    const colorName = this.playerColor === 'w' ? '白棋' : '黑棋';
    this.updateStatus(`轮到你了（${colorName}）`);
    this.gameInfoTurn.textContent = `${colorName}走`;
  }

  private isGameOver(): boolean {
    if (this.chess.isGameOver()) {
      this.phase = 'game_over';

      if (this.chess.isCheckmate()) {
        const winner = this.chess.turn() === 'w' ? '黑棋' : '白棋';
        const isPlayerWin = (winner === '白棋' && this.playerColor === 'w') ||
                            (winner === '黑棋' && this.playerColor === 'b');
        const statusClass = isPlayerWin ? 'win' : 'lose';
        this.updateStatusWithClass(`将杀！${winner}胜`, statusClass);
      } else if (this.chess.isDraw()) {
        if (this.chess.isStalemate()) this.updateStatusWithClass('逼和（无子可走）', 'draw');
        else if (this.chess.isThreefoldRepetition()) this.updateStatusWithClass('和棋（三次重复）', 'draw');
        else if (this.chess.isInsufficientMaterial()) this.updateStatusWithClass('和棋（子力不足）', 'draw');
        else this.updateStatusWithClass('和棋', 'draw');
      }

      this.showGameOverState();
      this.render();
      return true;
    }
    return false;
  }

  private undoMove() {
    if (this.phase !== 'player_turn') return;

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

    if (this.moveHistory.length > 0) {
      const last = this.moveHistory[this.moveHistory.length - 1];
      this.board.setLastMove(last.from as Square, last.to as Square);
    } else {
      this.board.clearLastMove();
    }

    this.render();
    this.updateStatus('已悔棋，继续下');
    const colorName = this.playerColor === 'w' ? '白棋' : '黑棋';
    this.gameInfoTurn.textContent = `${colorName}走`;
  }

  private cleanupGame() {
    const engine = getEngine();
    if (engine.isThinking()) engine.stop();
    this.chess = new Chess();
    this.moveHistory = [];
    this.selectedSquare = null;
    this.board.clearSelection();
    this.board.clearLastMove();
    this.board.clearHighlights();
    this.phase = 'setup';
    this.btnDownloadPgn.classList.add('hidden');
    this.render();
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
    this.statusEl.className = 'panel-section game-status';
  }

  private updateStatusWithClass(msg: string, className: string) {
    this.statusEl.innerHTML = `<span class="${className}">${msg}</span>`;
  }

  private downloadPgn() {
    const pgn = this.chess.pgn();
    if (!pgn) return;
    const blob = new Blob([pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-game-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
