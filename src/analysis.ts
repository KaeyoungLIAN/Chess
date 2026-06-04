/**
 * 复盘分析模式
 * 加载 PGN 后自动逐路引擎分析，每步显示评估值和最佳走法
 */

import { Chess, type Square, type Move } from 'chess.js';
import { ChessBoard } from './board';
import { getEngine } from './engine';
import { renderAnalysisMoveHistory } from './moveHistory';

export interface EvalResult {
  move: string;
  score: number | null;
  mate: number | null;
  depth: number;
  multipv: number;
}

/** 缓存中单步的分析结果 */
interface StepEval {
  best: string;           // 最佳走法 UCI
  cp: number | null;      // 局面评估 (centipawn)
  mate: number | null;    // 将杀
  depth: number;
  moves: { move: string; cp: number | null; mate: number | null }[]; // top3
}

export class AnalysisManager {
  private chess: Chess;
  private board: ChessBoard;
  private moves: Move[] = [];
  private currentIndex: number = -1;

  // DOM
  private pgnInput: HTMLTextAreaElement;
  private moveListEl: HTMLElement;
  private moveCounterEl: HTMLElement;
  private bestLineEl: HTMLElement;
  private multiPvEl: HTMLElement;
  private blinkEl: HTMLElement;
  private evalBarFill: HTMLElement;
  private evalBarLabel: HTMLElement;
  private navSection: HTMLElement;
  private detailSection: HTMLElement;

  // 分析缓存: 第 N 步后的评估
  private evals: (StepEval | null)[] = [];
  private analyzing: boolean = false;
  private queuedIndex: number | null = null;

  constructor() {
    this.chess = new Chess();

    this.board = new ChessBoard({
      id: 'analysis-board',
      orientation: 'white',
      onSquareClick: () => {},
    });

    this.pgnInput = document.getElementById('pgn-input') as HTMLTextAreaElement;
    this.moveListEl = document.getElementById('analysis-move-list')!;
    this.moveCounterEl = document.getElementById('move-counter')!;
    this.bestLineEl = document.getElementById('analysis-best-line')!;
    this.multiPvEl = document.getElementById('analysis-multi-pv')!;
    this.blinkEl = document.getElementById('analysis-blink')!;
    this.evalBarFill = document.getElementById('eval-bar-fill')!;
    this.evalBarLabel = document.getElementById('eval-bar-label')!;
    this.navSection = document.getElementById('analysis-nav-section')!;
    this.detailSection = document.getElementById('analysis-detail')!;

    this.bindControls();
    this.board.renderEmpty();
  }

  private bindControls() {
    document.getElementById('btn-load-pgn')?.addEventListener('click', () => this.loadPGN());

    document.getElementById('btn-first')?.addEventListener('click', () => this.goTo(-1));
    document.getElementById('btn-prev')?.addEventListener('click', () => this.goTo(this.currentIndex - 1));
    document.getElementById('btn-next')?.addEventListener('click', () => this.goTo(this.currentIndex + 1));
    document.getElementById('btn-last')?.addEventListener('click', () => this.goTo(this.moves.length - 1));

    document.addEventListener('keydown', (e) => {
      if (this.moves.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        this.goTo(this.currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goTo(this.currentIndex - 1);
      }
    });
  }

  // ══════════════ 加载 PGN ══════════════

  private loadPGN() {
    const pgn = this.pgnInput.value.trim();
    if (!pgn) return;

    try {
      const temp = new Chess();
      temp.loadPgn(pgn);
      this.moves = temp.history({ verbose: true });
      if (this.moves.length === 0) {
        this.showBlink('PGN 解析成功但没有走棋记录', 'warn');
        return;
      }

      // 重置
      this.chess = new Chess();
      this.currentIndex = -1;
      this.evals = [];
      this.board.clearHighlights();
      this.board.renderEmpty();
      this.render();

      this.navSection.classList.remove('hidden');
      this.detailSection.classList.remove('hidden');
      this.updateNavCounter();
      this.renderMoveList();
      this.showBlink(`已加载 ${this.moves.length} 步，正在分析...`, 'info');

      // 开始后台逐步分析
      this.analyzeAllMoves();

    } catch (e) {
      this.showBlink(`PGN 解析失败: ${(e as Error).message}`, 'error');
    }
  }

  // ══════════════ 引擎分析 ══════════════

  private async analyzeAllMoves() {
    const engine = getEngine();
    if (!engine.isReady()) {
      this.showBlink('引擎未就绪', 'warn');
      return;
    }

    this.analyzing = true;
    const total = this.moves.length;

    // 逐步分析: 对第 N 步后的局面进行评估
    for (let i = 0; i <= total; i++) {
      if (!this.analyzing) break; // 可能被新加载中断

      if (this.evals[i] !== undefined) continue; // 已分析过

      const working = new Chess();
      for (let j = 0; j < i; j++) {
        working.move(this.moves[j].san);
      }

      if (working.isGameOver()) {
        this.evals[i] = null;
        continue;
      }

      // 发送局面给引擎
      const history = working.history({ verbose: false });
      engine.setStartPosition(history);

      try {
        const results = await engine.analyzePosition(10, 1000);
        const step: StepEval = {
          best: results[0]?.move || '',
          cp: results[0]?.score ?? null,
          mate: results[0]?.mate ?? null,
          depth: results[0]?.depth || 0,
          moves: results.slice(0, 3).map(r => ({
            move: r.move,
            cp: r.score,
            mate: r.mate,
          })),
        };
        this.evals[i] = step;
      } catch {
        this.evals[i] = null;
      }

      // 如果当前正在看这一步(或附近)，实时更新显示
      if (this.currentIndex === i || this.currentIndex === i - 1) {
        this.showEval(this.currentIndex);
      }

      // 更新棋谱中的评估显示
      this.renderMoveList();

      // 小延迟避免引擎过载
      await new Promise(r => setTimeout(r, 50));
    }

    this.analyzing = false;
    this.showBlink('分析完成', 'success');
  }

  // ══════════════ 导航 ══════════════

  private goTo(targetIndex: number) {
    targetIndex = Math.max(-1, Math.min(this.moves.length - 1, targetIndex));
    if (targetIndex === this.currentIndex) return;
    this.currentIndex = targetIndex;

    // 重放
    this.chess = new Chess();
    for (let i = 0; i <= this.currentIndex; i++) {
      try { this.chess.move(this.moves[i].san); } catch { break; }
    }

    this.board.clearHighlights();
    this.render();
    this.updateNavCounter();
    this.renderMoveList();
    this.showEval(targetIndex);
  }

  // ══════════════ 渲染评估 ══════════════

  private showEval(index: number) {
    const e = this.evals[index];
    if (!e) {
      this.bestLineEl.innerHTML = '<span class="eval-pending">分析中...</span>';
      this.multiPvEl.innerHTML = '';
      this.updateEvalBar(0, null);
      return;
    }

    // 最佳走法
    const turn = (index < 0 || this.chess.turn() === 'w') ? '白方' : '黑方';
    const bestLineHtml = e.best
      ? `<span class="eval-best-label">最佳走法:</span> <span class="eval-mono">${this.uciToDisplay(e.best)}</span>
         <span class="eval-score">${this.formatScore(e.cp, e.mate)}</span>
         <span class="eval-depth">深度 ${e.depth}</span>`
      : '<span class="eval-pending">无数据</span>';
    this.bestLineEl.innerHTML = bestLineHtml;

    // Top3 备选
    if (e.moves.length > 1) {
      const top = e.cp !== null ? e.cp : 0;
      this.multiPvEl.innerHTML = e.moves.slice(0, 3).map((m, i) => {
        const loss = m.cp !== null && e.cp !== null && i > 0 ? top - m.cp : 0;
        const lossText = loss > 30 ? `<span class="eval-loss">亏 ${(loss / 100).toFixed(2)}</span>` : '';
        return `<div class="pv-row">
          <span class="pv-rank">${i + 1}</span>
          <span class="eval-mono">${this.uciToDisplay(m.move)}</span>
          <span class="pv-score">${this.formatScore(m.cp, m.mate)}</span>
          ${lossText}
        </div>`;
      }).join('');
    } else {
      this.multiPvEl.innerHTML = '';
    }

    // 评估柱
    this.updateEvalBar(e.cp, e.mate);
  }

  private updateEvalBar(cp: number | null, mate: number | null) {
    // 将杀: 满
    let pct = 50;
    if (mate !== null) {
      pct = mate > 0 ? 0 : 100;
    } else if (cp !== null) {
      // cp -> 百分比, ±500 封顶
      pct = 50 - Math.max(-500, Math.min(500, cp)) / 10;
      pct = Math.max(5, Math.min(95, pct));
    }

    // pct = 白方优势百分比
    this.evalBarFill.style.width = `${Math.max(pct, 0)}%`;

    // 标签
    let label = '0.00';
    if (mate !== null) {
      label = `#${Math.abs(mate)}`;
    } else if (cp !== null) {
      label = (cp / 100).toFixed(2);
      if (cp > 0) label = '+' + label;
    }
    this.evalBarLabel.textContent = label;
  }

  // ══════════════ 辅助 ══════════════

  /** UCI "e2e4" => "e4" 显示 */
  private uciToDisplay(uci: string): string {
    if (uci.length < 4) return uci;
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const p = uci.length > 4 ? uci[4].toUpperCase() : '';
    return `${from} → ${to}${p}`;
  }

  private formatScore(cp: number | null, mate: number | null): string {
    if (mate !== null) return `#${Math.abs(mate)}`;
    if (cp !== null) return (cp / 100).toFixed(2);
    return '-';
  }

  private showBlink(msg: string, type: 'info' | 'warn' | 'error' | 'success') {
    const colors: Record<string, string> = {
      info: 'color:var(--text-secondary)',
      warn: 'color:var(--warning)',
      error: 'color:var(--danger)',
      success: 'color:var(--success)',
    };
    this.blinkEl.innerHTML = `<span style="${colors[type]}">${msg}</span>`;
  }

  private render() {
    this.board.render(this.chess);
  }

  private updateNavCounter() {
    this.moveCounterEl.textContent = `${this.currentIndex + 1} / ${this.moves.length}`;
  }

  private renderMoveList() {
    renderAnalysisMoveHistory(this.moveListEl, this.moves, this.currentIndex, (idx) => {
      this.goTo(idx);
    }, this.evals);
  }
}
