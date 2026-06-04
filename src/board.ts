/**
 * 棋盘渲染与交互组件
 * 纯 DOM 渲染，无 canvas，支持棋子拖拽和高亮
 */

import { Chess, type Square, type Piece, type Move } from 'chess.js';

export type BoardTheme = 'modern';
export type BoardOrientation = 'white' | 'black';

export interface BoardOptions {
  id: string;
  orientation?: BoardOrientation;
  draggable?: boolean;
  onMove?: (from: Square, to: Square) => void;
  onSquareClick?: (square: Square) => void;
}

export class ChessBoard {
  private container: HTMLElement;
  private boardEl: HTMLElement;
  private options: BoardOptions;
  private orientation: BoardOrientation = 'white';
  private draggable: boolean;
  private selectedSquare: Square | null = null;
  private legalSquares: Square[] = [];
  private lastMove: { from: Square; to: Square } | null = null;
  private highlightedSquares: Square[] = [];
  private pieceChars: Record<string, string> = {
    'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
    'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
  };

  constructor(options: BoardOptions) {
    this.options = options;
    this.orientation = options.orientation || 'white';
    this.draggable = options.draggable ?? true;
    
    const el = document.getElementById(options.id);
    if (!el) throw new Error(`Board container #${options.id} not found`);
    this.container = el;
    
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board-container';
    this.container.appendChild(this.boardEl);
  }

  /** 渲染棋盘 */
  render(chess: Chess) {
    this.boardEl.innerHTML = '';
    const squares = this.orientation === 'white'
      ? this.getSquaresWhite()
      : this.getSquaresBlack();
    
    for (const sq of squares) {
      const squareEl = document.createElement('div');
      const rank = parseInt(sq[1]);
      const isLight = (sq.charCodeAt(0) - 97 + rank) % 2 === 1;
      squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
      squareEl.dataset.square = sq;

      // 选中的格子
      if (sq === this.selectedSquare) {
        squareEl.classList.add('selected');
      }
      
      // 上一步移动
      if (this.lastMove) {
        if (sq === this.lastMove.from || sq === this.lastMove.to) {
          squareEl.classList.add('last-move');
        }
      }

      // 高亮
      if (this.highlightedSquares.includes(sq as Square)) {
        squareEl.classList.add('highlight');
      }

      // 合法走法提示
      if (this.selectedSquare && this.legalSquares.includes(sq as Square)) {
        const hasPiece = chess.get(sq as Square);
        if (hasPiece) {
          squareEl.classList.add('legal-capture');
        } else {
          squareEl.classList.add('legal-move');
        }
      }

      // 棋子
      const piece = chess.get(sq as Square);
      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece';
        span.textContent = this.pieceChars[piece.color + piece.type] || piece.type;
        span.draggable = false;
        squareEl.appendChild(span);
      }

      // 坐标标注（边上的）
      const file = sq.charCodeAt(0) - 97;
      const r = parseInt(sq[1]);
      if (file === 0) {
        const label = document.createElement('span');
        label.style.cssText = 'position:absolute;top:2px;left:3px;font-size:10px;color:rgba(0,0,0,0.3);pointer-events:none;';
        label.textContent = String(r);
        squareEl.appendChild(label);
      }
      if (r === 1) {
        const label = document.createElement('span');
        label.style.cssText = 'position:absolute;bottom:2px;right:3px;font-size:10px;color:rgba(0,0,0,0.3);pointer-events:none;';
        label.textContent = String.fromCharCode(97 + file);
        if (this.orientation === 'black') {
          label.textContent = String.fromCharCode(104 - file);
          label.style.right = 'auto';
          label.style.left = '3px';
        }
        squareEl.appendChild(label);
      }

      // 点击事件
      squareEl.addEventListener('click', () => {
        if (this.options.onSquareClick) {
          this.options.onSquareClick(sq as Square);
        }
      });

      this.boardEl.appendChild(squareEl);
    }
  }

  /** 设置选中的格子和合法走法 */
  setSelected(square: Square | null, legalMoves: Square[] = []) {
    this.selectedSquare = square;
    this.legalSquares = legalMoves;
  }

  /** 清除选择 */
  clearSelection() {
    this.selectedSquare = null;
    this.legalSquares = [];
  }

  /** 设置上一步走棋 */
  setLastMove(from: Square, to: Square) {
    this.lastMove = { from, to };
  }

  clearLastMove() {
    this.lastMove = null;
  }

  /** 设置高亮格子（用于复盘分析） */
  setHighlights(squares: Square[]) {
    this.highlightedSquares = squares;
  }

  clearHighlights() {
    this.highlightedSquares = [];
  }

  /** 设置棋盘朝向 */
  setOrientation(orientation: BoardOrientation) {
    this.orientation = orientation;
  }

  getOrientation() { return this.orientation; }

  /** 获取点击的格子 */
  getSquareFromEvent(ev: MouseEvent): Square | null {
    const target = ev.target as HTMLElement;
    const sq = target.closest('[data-square]')?.getAttribute('data-square');
    return sq as Square | null;
  }

  private getSquaresWhite(): string[] {
    const squares: string[] = [];
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        squares.push(String.fromCharCode(97 + f) + r);
      }
    }
    return squares;
  }

  private getSquaresBlack(): string[] {
    const squares: string[] = [];
    for (let r = 1; r <= 8; r++) {
      for (let f = 7; f >= 0; f--) {
        squares.push(String.fromCharCode(97 + f) + r);
      }
    }
    return squares;
  }
}
