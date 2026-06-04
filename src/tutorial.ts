/**
 * 教学课程 — 互动棋盘演示
 *
 * 每个演示项：初始局面 + UCI 走法列表
 * 支持逐步步进回放
 */

import { Chess } from 'chess.js';
import { ChessBoard } from './board';

// ── 演示场景定义 ──

export interface TutorialDemo {
  name: string;
  fen?: string;           // 自定义局面，空则标准开局
  moves?: string[];       // UCI 走法，支持逐步回放
}

const DEMOS: Record<string, TutorialDemo> = {
  // ═══════════════════════ 整体概述 ═══════════════════════
  'initial-setup': {
    name: '初始局面',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  'piece-movement': {
    name: '棋子走法示意',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['e2e4', 'd7d5', 'g1f3', 'b8c6', 'f1c4', 'c8e6', 'd1e2', 'g8f6'],
  },
  'castling': {
    name: '王车易位',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
    moves: ['e1g1', 'e8g8'],
  },
  'en-passant': {
    name: '吃过路兵',
    fen: 'rnbqkbnr/1ppppppp/p7/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
    moves: ['d7d5', 'e5d6'],
  },

  // ═══════════════════════ 开局（12个经典开局） ═══════════════════════
  // ── 开放性开局 ──
  'italian-opening': {
    name: '意大利开局 — 1.e4 e5 2.Nf3 Nc6 3.Bc4',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4', 'c3d4'],
  },
  'spanish-opening': {
    name: '西班牙开局 — 1.e4 e5 2.Nf3 Nc6 3.Bb5',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'],
  },
  'scotch-game': {
    name: '苏格兰开局 — 1.e4 e5 2.Nf3 Nc6 3.d4',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4'],
  },
  'kings-gambit': {
    name: '王翼弃兵 — 1.e4 e5 2.f4',
    moves: ['e2e4', 'e7e5', 'f2f4'],
  },

  // ── 半开放性开局 ──
  'sicilian-defense': {
    name: '西西里防御 — 1.e4 c5',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
  },
  'french-defense': {
    name: '法兰西防御 — 1.e4 e6',
    moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'b8c6'],
  },
  'caro-kann': {
    name: '卡罗·康防御 — 1.e4 c6',
    moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5'],
  },
  'pirc-defense': {
    name: '皮尔茨防御 — 1.e4 d6',
    moves: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6'],
  },

  // ── 封闭性开局 ──
  'queens-gambit': {
    name: '后翼弃兵 — 1.d4 d5 2.c4',
    moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c4d5', 'e6d5'],
  },
  'slav-defense': {
    name: '斯拉夫防御 — 1.d4 d5 2.c4 c6',
    moves: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'd5c4'],
  },
  'kings-indian': {
    name: '古印度防御 — 1.d4 Nf6 2.c4 g6',
    moves: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8'],
  },
  'nimzo-indian': {
    name: '尼姆佐维奇防御 — 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4',
    moves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'],
  },

  // ═══════════════════════ 中局战术 ═══════════════════════
  'pin-tactic': {
    name: '牵制战术',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
    moves: ['c4f7', 'e8f7', 'f3e5'],
  },
  'fork-tactic': {
    name: '双击（马叉）',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5',
    moves: ['f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7'],
  },
  'skewer-tactic': {
    name: '串击',
    fen: '4k3/8/8/4b3/8/8/3R4/4K3 w - - 0 1',
    moves: ['d2e2', 'e5b2'],
  },
  'discovered-attack': {
    name: '闪击',
    fen: 'r3kb1r/ppp1pppp/2n2n2/8/8/3P1N2/PPP1QPPP/R1B1K2R w KQkq - 1 8',
    moves: ['e2e6'],
  },

  // ═══════════════════════ 残局 ═══════════════════════
  'king-queen-mate': {
    name: '单后杀王',
    fen: '8/8/8/8/3k4/8/4Q3/4K3 w - - 0 1',
    moves: ['e2e3', 'd4d5', 'e3d3', 'd5e5', 'e1d2', 'e5f4', 'd3e3'],
  },
  'king-rook-mate': {
    name: '单车杀王',
    fen: '8/8/8/8/3k4/8/4R3/4K3 w - - 0 1',
    moves: ['e1d2', 'd4e5', 'e2e3', 'e5d5', 'd2d3', 'd5c5', 'e3e4', 'c5d6', 'd3d4', 'd6c6', 'e4e5', 'c6d7'],
  },
  'passed-pawn': {
    name: '通路兵推进',
    fen: '8/8/8/8/4k3/2P5/8/4K3 w - - 0 1',
    moves: ['c3c4', 'e4d4', 'c4c5', 'd4d5', 'c5c6', 'd5d6', 'c6c7', 'd6d7', 'c7c8q'],
  },
};

// ── TutorialManager ──

export class TutorialManager {
  private chess = new Chess();
  private board: ChessBoard;
  private demo: TutorialDemo | null = null;
  private currentMoveIndex = -1;    // -1 = 初始局面
  private fullMoves: string[] = [];

  constructor() {
    this.board = new ChessBoard({ id: 'tutorial-board' });
    this.renderDemo('initial-setup');
  }

  renderDemo(key: string) {
    const demo = DEMOS[key];
    if (!demo) return;

    this.demo = demo;
    this.chess = new Chess(demo.fen || undefined);
    this.fullMoves = demo.moves || [];
    this.currentMoveIndex = -1;
    this.board.clearSelection();
    this.board.clearHighlights();
    this.board.clearLastMove();
    this.board.render(this.chess);

    // 更新演示名称
    const nameEl = document.getElementById('tutorial-demo-name');
    if (nameEl) nameEl.textContent = demo.name;

    this.updateControls();
  }

  stepForward() {
    if (!this.demo || this.currentMoveIndex >= this.fullMoves.length - 1) return;

    this.currentMoveIndex++;
    const uci = this.fullMoves[this.currentMoveIndex];

    const from = uci.substring(0, 2) as any;
    const to = uci.substring(2, 4) as any;
    const promotion = uci.length > 4 ? uci[4] as 'q' | 'r' | 'b' | 'n' : undefined;

    try {
      const move = this.chess.move({ from, to, promotion });
      if (move) {
        this.board.setLastMove(move.from, move.to);
        this.board.render(this.chess);
      }
    } catch {
      // 跳过无效走法
    }

    this.updateControls();
  }

  stepBackward() {
    if (!this.demo || this.currentMoveIndex < 0) return;

    this.chess.undo();
    this.currentMoveIndex--;

    // 恢复上一步的高亮
    if (this.currentMoveIndex >= 0) {
      const uci = this.fullMoves[this.currentMoveIndex];
      const from = uci.substring(0, 2) as any;
      const to = uci.substring(2, 4) as any;
      this.board.setLastMove(from, to);
    } else {
      this.board.clearLastMove();
    }
    this.board.render(this.chess);

    this.updateControls();
  }

  private updateControls() {
    const total = this.fullMoves.length;
    const current = this.currentMoveIndex + 1;
    const counter = document.getElementById('tut-step-counter');
    if (counter) counter.textContent = `${Math.max(0, current)} / ${total}`;

    const backBtn = document.getElementById('tut-step-back')!;
    const fwdBtn = document.getElementById('tut-step-fwd')!;

    backBtn.toggleAttribute('disabled', this.currentMoveIndex < 0);
    fwdBtn.toggleAttribute('disabled', this.currentMoveIndex >= total - 1);
  }
}

/** 获取所有演示键列表（用于外部枚举） */
export function getDemoKeys(): string[] {
  return Object.keys(DEMOS);
}
