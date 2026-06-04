/**
 * 棋盘渲染与交互组件
 * 纯 DOM 渲染，使用内联 SVG 棋子区分颜色
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

/**
 * 内联 SVG 棋子 — 白棋白底黑边，黑棋深色
 */
const PIECE_SVGS: Record<string, string> = {
  'wK': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#fff" fill-opacity="1" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,11.63 L 22.5,6" fill="none" stroke="#000" stroke-width="1.5"/><path d="M 20,8 L 25,8" fill="none" stroke="#000" stroke-width="1.5"/><path d="M 22.5,25 L 22.5,30" fill="none" stroke="#000" stroke-width="1.5"/><path d="M 12,25 L 33,25" fill="none" stroke="#000" stroke-width="1.5"/><path d="M 10,25 C 10,20 15,16 22.5,16 C 30,16 35,20 35,25" fill="#fff" stroke="#000" stroke-width="1.5"/><path d="M 11.5,30 C 16,28 29,28 33.5,30" fill="none" stroke="#000"/><path d="M 11.5,30 C 16,33 29,33 33.5,30 C 35,32 34,36 30,36 C 27,36 25,34 22.5,34 C 20,34 18,36 15,36 C 11,36 10,32 11.5,30" fill="#fff" stroke="#000" stroke-width="1.5"/></g></svg>`,
  'wQ': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#fff" fill-opacity="1" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,26 C 12,22 14,20 18,20 L 27,20 C 31,20 33,22 36,26 L 36,35 C 36,36 35,37 34,37 L 11,37 C 10,37 9,36 9,35 Z" fill="#fff" stroke="#000"/><path d="M 22.5,7 L 20,12 L 16,8 L 18,15 L 12,11 L 16,19 L 22.5,19 L 29,19 L 33,11 L 27,15 L 29,8 L 25,12 Z" fill="#fff" stroke="#000"/><circle cx="22.5" cy="24" r="1.5" fill="#000"/><circle cx="16" cy="24" r="1.5" fill="#000"/><circle cx="29" cy="24" r="1.5" fill="#000"/><path d="M 11,30 C 16,27 29,27 34,30" fill="none" stroke="#000"/></g></svg>`,
  'wR': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#fff" fill-opacity="1" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,39 L 36,39 L 36,36 L 9,36 Z" fill="#fff" stroke="#000"/><path d="M 12,36 L 12,32 L 33,32 L 33,36" fill="none" stroke="#000"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" fill="#fff" stroke="#000"/><rect x="11" y="14" width="23" height="18" rx="2" ry="2" fill="#fff" stroke="#000"/><rect x="12" y="16" width="21" height="14" rx="1" ry="1" fill="none" stroke="#000"/></g></svg>`,
  'wB': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#fff" fill-opacity="1" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 15,32 C 17,28 20,25 22.5,25 C 25,25 28,28 30,32" fill="none" stroke="#000"/><path d="M 22.5,5 C 22.5,5 18,14 15,24 L 30,24 C 27,14 22.5,5 22.5,5" fill="#fff" stroke="#000"/><circle cx="22.5" cy="13" r="2" fill="#000"/><path d="M 22.5,25 C 22.5,25 22.5,36 22.5,38" fill="none" stroke="#000"/><path d="M 12,38 L 33,38" fill="none" stroke="#000"/><path d="M 12,38 C 18,36 27,36 33,38" fill="none" stroke="#000"/></g></svg>`,
  'wN': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#fff" fill-opacity="1" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22,10 C 26,7 30,8 32,12 L 28,20 L 35,27 L 27,36 L 18,36 L 12,27 C 12,27 8,24 14,16 C 17,12 19,11 22,10" fill="#fff" stroke="#000"/><path d="M 30,16 L 29,19" fill="none" stroke="#000"/><path d="M 25,13 C 27,11 29,12 30,15" fill="none" stroke="#000"/><path d="M 16,36 L 30,36" fill="none" stroke="#000"/><path d="M 14,36 L 14,38 L 32,38 L 32,36" fill="none" stroke="#000"/><ellipse cx="28" cy="15" rx="1" ry="0.8" fill="#000"/><ellipse cx="23.5" cy="14.5" rx="1" ry="0.8" fill="#000"/></g></svg>`,
  'wP': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#fff" fill-opacity="1" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,9 C 19,9 16,12 16,16 C 16,20 19,23 22.5,23 C 26,23 29,20 29,16 C 29,12 26,9 22.5,9 Z" fill="#fff" stroke="#000"/><path d="M 16,23 L 29,23 L 29,27 L 16,27 Z" fill="#fff" stroke="#000"/><path d="M 13,31 L 32,31 L 32,33 C 32,34 31,35 30,35 L 15,35 C 14,35 13,34 13,33 Z" fill="#fff" stroke="#000"/></g></svg>`,

  'bK': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#1a1a1a" fill-opacity="1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,11.63 L 22.5,6" fill="none" stroke="#1a1a1a" stroke-width="1.5"/><path d="M 20,8 L 25,8" fill="none" stroke="#1a1a1a" stroke-width="1.5"/><path d="M 22.5,25 L 22.5,30" fill="none" stroke="#1a1a1a" stroke-width="1.5"/><path d="M 12,25 L 33,25" fill="none" stroke="#1a1a1a" stroke-width="1.5"/><path d="M 10,25 C 10,20 15,16 22.5,16 C 30,16 35,20 35,25" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="1.5"/><path d="M 11.5,30 C 16,28 29,28 33.5,30" fill="none" stroke="#1a1a1a"/><path d="M 11.5,30 C 16,33 29,33 33.5,30 C 35,32 34,36 30,36 C 27,36 25,34 22.5,34 C 20,34 18,36 15,36 C 11,36 10,32 11.5,30" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="1.5"/></g></svg>`,
  'bQ': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#1a1a1a" fill-opacity="1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,26 C 12,22 14,20 18,20 L 27,20 C 31,20 33,22 36,26 L 36,35 C 36,36 35,37 34,37 L 11,37 C 10,37 9,36 9,35 Z" fill="#1a1a1a" stroke="#1a1a1a"/><path d="M 22.5,7 L 20,12 L 16,8 L 18,15 L 12,11 L 16,19 L 22.5,19 L 29,19 L 33,11 L 27,15 L 29,8 L 25,12 Z" fill="#1a1a1a" stroke="#1a1a1a"/><circle cx="22.5" cy="24" r="1.5" fill="#fff"/><circle cx="16" cy="24" r="1.5" fill="#fff"/><circle cx="29" cy="24" r="1.5" fill="#fff"/><path d="M 11,30 C 16,27 29,27 34,30" fill="none" stroke="#1a1a1a"/></g></svg>`,
  'bR': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#1a1a1a" fill-opacity="1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,39 L 36,39 L 36,36 L 9,36 Z" fill="#1a1a1a" stroke="#1a1a1a"/><path d="M 12,36 L 12,32 L 33,32 L 33,36" fill="none" stroke="#1a1a1a"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" fill="#1a1a1a" stroke="#1a1a1a"/><rect x="11" y="14" width="23" height="18" rx="2" ry="2" fill="#1a1a1a" stroke="#1a1a1a"/><rect x="12" y="16" width="21" height="14" rx="1" ry="1" fill="none" stroke="#1a1a1a"/></g></svg>`,
  'bB': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#1a1a1a" fill-opacity="1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 15,32 C 17,28 20,25 22.5,25 C 25,25 28,28 30,32" fill="none" stroke="#1a1a1a"/><path d="M 22.5,5 C 22.5,5 18,14 15,24 L 30,24 C 27,14 22.5,5 22.5,5" fill="#1a1a1a" stroke="#1a1a1a"/><circle cx="22.5" cy="13" r="2" fill="#fff"/><path d="M 22.5,25 C 22.5,25 22.5,36 22.5,38" fill="none" stroke="#1a1a1a"/><path d="M 12,38 L 33,38" fill="none" stroke="#1a1a1a"/><path d="M 12,38 C 18,36 27,36 33,38" fill="none" stroke="#1a1a1a"/></g></svg>`,
  'bN': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#1a1a1a" fill-opacity="1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22,10 C 26,7 30,8 32,12 L 28,20 L 35,27 L 27,36 L 18,36 L 12,27 C 12,27 8,24 14,16 C 17,12 19,11 22,10" fill="#1a1a1a" stroke="#1a1a1a"/><path d="M 30,16 L 29,19" fill="none" stroke="#1a1a1a"/><path d="M 25,13 C 27,11 29,12 30,15" fill="none" stroke="#1a1a1a"/><path d="M 16,36 L 30,36" fill="none" stroke="#1a1a1a"/><path d="M 14,36 L 14,38 L 32,38 L 32,36" fill="none" stroke="#1a1a1a"/><ellipse cx="28" cy="15" rx="1.5" ry="1" fill="#fff"/><ellipse cx="23.5" cy="14.5" rx="1.5" ry="1" fill="#fff"/></g></svg>`,
  'bP': `<svg viewBox="0 0 45 45" width="100%" height="100%"><g fill="#1a1a1a" fill-opacity="1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,9 C 19,9 16,12 16,16 C 16,20 19,23 22.5,23 C 26,23 29,20 29,16 C 29,12 26,9 22.5,9 Z" fill="#1a1a1a" stroke="#1a1a1a"/><path d="M 16,23 L 29,23 L 29,27 L 16,27 Z" fill="#1a1a1a" stroke="#1a1a1a"/><path d="M 13,31 L 32,31 L 32,33 C 32,34 31,35 30,35 L 15,35 C 14,35 13,34 13,33 Z" fill="#1a1a1a" stroke="#1a1a1a"/></g></svg>`,
};

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

      // 棋子 — 内联 SVG
      const piece = chess.get(sq as Square);
      if (piece) {
        const svgKey = piece.color + piece.type.toUpperCase();
        const svgContent = PIECE_SVGS[svgKey];
        if (svgContent) {
          squareEl.innerHTML += svgContent;
        }
      }

      // 坐标标注
      const file = sq.charCodeAt(0) - 97;
      const r = parseInt(sq[1]);
      if (file === 0) {
        const label = document.createElement('span');
        label.style.cssText = 'position:absolute;top:2px;left:3px;font-size:10px;color:rgba(0,0,0,0.3);pointer-events:none;line-height:1;';
        label.textContent = String(r);
        squareEl.appendChild(label);
      }
      if (r === 1) {
        const label = document.createElement('span');
        label.style.cssText = 'position:absolute;bottom:2px;right:3px;font-size:10px;color:rgba(0,0,0,0.3);pointer-events:none;line-height:1;';
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
