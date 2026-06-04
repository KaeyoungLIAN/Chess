/**
 * 棋盘渲染与交互组件
 * 使用 Lichess Merida SVG 棋子
 */

import { Chess, type Square } from 'chess.js';

export type BoardOrientation = 'white' | 'black';

export interface BoardOptions {
  id: string;
  orientation?: BoardOrientation;
  onSquareClick?: (square: Square) => void;
}

const PIECE_IMAGES: Record<string, string> = {
  wk: '/pieces/wK.svg', wq: '/pieces/wQ.svg', wr: '/pieces/wR.svg',
  wb: '/pieces/wB.svg', wn: '/pieces/wN.svg', wp: '/pieces/wP.svg',
  bk: '/pieces/bK.svg', bq: '/pieces/bQ.svg', br: '/pieces/bR.svg',
  bb: '/pieces/bB.svg', bn: '/pieces/bN.svg', bp: '/pieces/bP.svg',
};

const FILES = ['a','b','c','d','e','f','g','h'];

export class ChessBoard {
  private container: HTMLElement;
  private boardEl: HTMLElement;
  private options: BoardOptions;
  private orientation: BoardOrientation = 'white';
  private _selectedSquare: Square | null = null;
  private _legalSquares: Square[] = [];
  private _lastMove: { from: Square; to: Square } | null = null;
  private _highlightSquares: Square[] = [];

  constructor(options: BoardOptions) {
    this.options = options;
    this.orientation = options.orientation || 'white';

    const el = document.getElementById(options.id);
    if (!el) throw new Error(`Board container #${options.id} not found`);
    this.container = el;

    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board-container';
    this.container.appendChild(this.boardEl);

    // 初始渲染空棋盘
    this.renderEmpty();
  }

  /** 获取棋盘格子列表 */
  private getSquares(): Square[] {
    const squares: Square[] = [];
    const files = this.orientation === 'white' ? FILES : [...FILES].reverse();
    for (let r = this.orientation === 'white' ? 8 : 1;
         this.orientation === 'white' ? r >= 1 : r <= 8;
         this.orientation === 'white' ? r-- : r++) {
      for (const f of files) {
        squares.push((f + r) as Square);
      }
    }
    return squares;
  }

  /** 渲染空棋盘（无棋子） */
  renderEmpty() {
    this.boardEl.innerHTML = '';
    const squares = this.getSquares();
    for (const sq of squares) {
      const squareEl = this.createSquareEl(sq);
      this.boardEl.appendChild(squareEl);
    }
  }

  /** 渲染完整棋盘（含棋子） */
  render(chess: Chess) {
    this.boardEl.innerHTML = '';
    const squares = this.getSquares();

    for (const sq of squares) {
      const squareEl = this.createSquareEl(sq);
      const piece = chess.get(sq);
      if (piece) {
        const imgKey = piece.color + piece.type;
        const imgSrc = PIECE_IMAGES[imgKey];
        if (imgSrc) {
          const img = document.createElement('img');
          img.className = 'piece-img';
          img.src = imgSrc;
          img.alt = piece.color + piece.type;
          img.draggable = false;
          squareEl.appendChild(img);
        }
      }
      this.boardEl.appendChild(squareEl);
    }
  }

  private createSquareEl(sq: Square): HTMLElement {
    const rank = parseInt(sq[1]);
    const isLight = ((sq.charCodeAt(0) - 97) + rank) % 2 === 1;
    const el = document.createElement('div');
    el.className = `square ${isLight ? 'light' : 'dark'}`;
    el.dataset.square = sq;

    // 上一步走棋
    if (this._lastMove && (sq === this._lastMove.from || sq === this._lastMove.to)) {
      el.classList.add('last-move');
    }

    // 选中的格子
    if (sq === this._selectedSquare) {
      el.classList.add('selected');
    }

    // 高亮
    if (this._highlightSquares.includes(sq)) {
      el.classList.add('highlight');
    }

    // 合法走法提示
    if (this._selectedSquare && this._legalSquares.includes(sq)) {
      el.classList.add(sq === this._selectedSquare ? '' : 'legal-move');
    }

    // 坐标标注：左侧边标注行数，底边标注列字母
    const fIdx = FILES.indexOf(sq[0]);
    const orientationFile = this.orientation === 'white' ? fIdx : 7 - fIdx;
    const orientationRank = this.orientation === 'white' ? rank : 9 - rank;

    if (orientationFile === 0) {
      const label = document.createElement('span');
      label.className = 'coord coord-rank';
      label.textContent = String(orientationRank);
      el.appendChild(label);
    }
    if (orientationRank === 1) {
      const label = document.createElement('span');
      label.className = 'coord coord-file';
      label.textContent = FILES[orientationFile];
      el.appendChild(label);
    }

    el.addEventListener('click', () => this.options.onSquareClick?.(sq));

    return el;
  }

  // ── 状态控制 ──

  setSelected(square: Square | null, legalMoves: Square[] = []) {
    this._selectedSquare = square;
    this._legalSquares = legalMoves;
  }

  clearSelection() {
    this._selectedSquare = null;
    this._legalSquares = [];
  }

  setLastMove(from: Square, to: Square) {
    this._lastMove = { from, to };
  }

  clearLastMove() {
    this._lastMove = null;
  }

  setHighlights(squares: Square[]) {
    this._highlightSquares = squares;
  }

  clearHighlights() {
    this._highlightSquares = [];
  }

  setOrientation(orientation: BoardOrientation) {
    this.orientation = orientation;
  }

  getOrientation() { return this.orientation; }
}
