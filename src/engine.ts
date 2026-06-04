/**
 * Stockfish 引擎封装 — 直接加载 lite-single Worker
 * 
 * stockfish-17.1-lite-single-*.js 本身就是为 Web Worker 设计的，
 * 直接 new Worker(path) 创建即可，不需要 Blob 包装。
 * 
 * 用法：
 *   const engine = getEngine();
 *   await engine.init();
 *   engine.setStartPosition(moves);
 *   const result = await engine.calculateBestMove(level, timeMs);
 */

export interface EvalResult {
  move: string;
  score: number | null;
  mate: number | null;
  depth: number;
  multipv: number;
}

export type EngineStatus = 'loading' | 'ready' | 'thinking' | 'idle' | 'error';

const ENGINE_BASENAME = 'stockfish-17.1-lite-single-03e3232';

class StockfishEngine {
  private worker: Worker | null = null;
  private status: EngineStatus = 'loading';
  private resolveReady: (() => void) | null = null;
  private pendingResolve: ((result: EvalResult[]) => void) | null = null;
  private evalResults: EvalResult[] = [];
  private initTimeout: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // lite-single JS 本身就是 Worker 入口，直接创建 Worker
        const workerUrl = `/assets/${ENGINE_BASENAME}.js`;
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e: MessageEvent) => {
          const line = String(e.data);
          this.handleOutput(line);

          // 引擎启动后会先输出版本信息，然后等待 uci 命令
          // 收到 uciok 表示就绪
          if (line === 'uciok' && this.resolveReady) {
            this.status = 'ready';
            this.resolveReady();
            this.resolveReady = null;
          }
        };

        this.worker.onerror = (e) => {
          reject(new Error(`Worker error: ${e.message}`));
        };

        // Worker 创建后发 uci 启动协议协商
        this.sendRaw('uci');

        this.resolveReady = resolve;

        // 安全兜底
        this.initTimeout = setTimeout(() => {
          if (this.resolveReady) {
            this.resolveReady();
            this.resolveReady = null;
            this.status = 'ready';
          }
        }, 10000);
      } catch (e) {
        reject(e);
      }
    });
  }

  private handleOutput(line: string) {
    // 解析 bestmove
    if (line.startsWith('bestmove')) {
      const match = line.match(/bestmove\s+(\S+)/);
      if (match && this.pendingResolve) {
        const move = match[1];

        // 按 depth 排序取前 3 条
        const sortedEvals = [...this.evalResults]
          .filter(e => e.depth > 0)
          .sort((a, b) => b.depth - a.depth)
          .slice(0, 3);

        if (sortedEvals.length > 0) {
          this.pendingResolve(sortedEvals);
        } else {
          this.pendingResolve([{
            move, score: null, mate: null, depth: 0, multipv: 1
          }]);
        }
        this.pendingResolve = null;
        this.status = 'idle';
      }
    }

    // 解析 info 行
    if (line.startsWith('info')) {
      const currMove = line.match(/currmove\s+\S+/);
      if (currMove) return;

      const evalEntry: EvalResult = {
        multipv: 1,
        depth: 0,
        score: null,
        mate: null,
        move: ''
      };

      const pvMatch = line.match(/multipv\s+(\d+)/);
      if (pvMatch) evalEntry.multipv = parseInt(pvMatch[1]);

      const depthMatch = line.match(/depth\s+(\d+)/);
      if (depthMatch) evalEntry.depth = parseInt(depthMatch[1]);

      const scoreMatch = line.match(/score\s+(cp|mate)\s+([-\d]+)/);
      if (scoreMatch) {
        if (scoreMatch[1] === 'cp') evalEntry.score = parseInt(scoreMatch[2]);
        else evalEntry.mate = parseInt(scoreMatch[2]);
      }

      const pv = line.match(/pv\s+(\S+)/);
      if (pv) evalEntry.move = pv[1];

      if (evalEntry.move && evalEntry.depth > 0) {
        this.evalResults.push(evalEntry);
      }
    }
  }

  private sendRaw(cmd: string) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  isReady(): boolean { return this.status === 'ready' || this.status === 'idle'; }
  isThinking(): boolean { return this.status === 'thinking'; }
  getStatus(): EngineStatus { return this.status; }

  setPosition(fen: string, moves: string[] = []) {
    const cmd = moves.length > 0
      ? `position fen ${fen} moves ${moves.join(' ')}`
      : `position fen ${fen}`;
    this.sendRaw(cmd);
  }

  setStartPosition(moves: string[] = []) {
    const cmd = moves.length > 0
      ? `position startpos moves ${moves.join(' ')}`
      : 'position startpos';
    this.sendRaw(cmd);
  }

  private setDifficulty(level: number) {
    const elo = Math.round(1320 + (level - 1) / 9 * (3190 - 1320));
    this.sendRaw('setoption name UCI_LimitStrength value true');
    this.sendRaw(`setoption name UCI_Elo value ${Math.min(3190, Math.max(1320, elo))}`);
  }

  async calculateBestMove(level: number = 5, timeMs: number = 1000): Promise<EvalResult[]> {
    return new Promise((resolve) => {
      this.status = 'thinking';
      this.evalResults = [];
      this.pendingResolve = resolve;

      this.setDifficulty(level);
      this.sendRaw(`go movetime ${timeMs}`);

      // 安全兜底
      const safetyTimer = setTimeout(() => {
        if (this.pendingResolve) {
          this.sendRaw('stop');
          this.status = 'idle';
          this.pendingResolve(this.evalResults.length > 0 ? this.evalResults : []);
          this.pendingResolve = null;
        }
      }, timeMs + 5000);
    });
  }

  async analyzePosition(level: number = 10, timeMs: number = 2000): Promise<EvalResult[]> {
    return new Promise((resolve) => {
      this.status = 'thinking';
      this.evalResults = [];
      this.pendingResolve = resolve;

      this.sendRaw('setoption name MultiPV value 3');
      this.setDifficulty(level);
      this.sendRaw(`go movetime ${timeMs}`);

      const safetyTimer = setTimeout(() => {
        if (this.pendingResolve) {
          this.sendRaw('stop');
          this.status = 'idle';
          this.sendRaw('setoption name MultiPV value 1');
          this.pendingResolve(this.evalResults.length > 0 ? this.evalResults : []);
          this.pendingResolve = null;
        }
      }, timeMs + 5000);
    });
  }

  stop() {
    if (this.status === 'thinking') {
      this.sendRaw('stop');
      this.status = 'idle';
    }
  }

  terminate() {
    if (this.initTimeout) clearTimeout(this.initTimeout);
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.status = 'error';
  }
}

let engineInstance: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!engineInstance) {
    engineInstance = new StockfishEngine();
  }
  return engineInstance;
}
