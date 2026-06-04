/**
 * Stockfish 引擎封装 — Web Worker 方案
 * 
 * Stockfish 的 lite-single 版本设计为在 Web Worker 中运行，
 * Worker 内部自动处理 WASM 加载和 UCI 通信。
 * 
 * 用法：
 *   const engine = getEngine();
 *   await engine.init();
 *   engine.setPosition(fen, moves);
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

class StockfishEngine {
  private worker: Worker | null = null;
  private status: EngineStatus = 'loading';
  private resolveReady: (() => void) | null = null;
  private pendingResolve: ((result: EvalResult[]) => void) | null = null;
  private evalResults: EvalResult[] = [];
  private cmdQueue: Array<{ cmd: string; resolve: (result: string) => void }> = [];
  private processingQueue = false;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 创建 Worker — Worker 脚本直接引用 stockfish JS
        // stockfish 的 JS 设计为同时支持 main thread 和 worker
        // 在 worker 环境中，它通过 onmessage/postMessage 通信
        const workerUrl = `/assets/${ENGINE_BASENAME}.js`;
        
        // 用 Blob 创建一个包装 Worker，加载 stockfish 脚本
        const workerCode = `
          importScripts('${workerUrl}');
          // Stockfish 已经在这个 Worker 上下文中运行
          // 它自动设置 onmessage 和 postMessage
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        
        this.worker = new Worker(blobUrl);
        URL.revokeObjectURL(blobUrl);
        
        this.worker.onmessage = (e: MessageEvent) => {
          const line = String(e.data);
          this.handleOutput(line);
          
          // 检查引擎是否就绪
          if (line === 'uciok' && this.resolveReady) {
            this.status = 'ready';
            this.resolveReady();
            this.resolveReady = null;
          }
        };
        
        this.worker.onerror = (e) => {
          reject(new Error(`Worker error: ${e.message}`));
        };

        // 发送 UCI 初始化命令
        // 引擎启动后可能先输出一些版本信息，然后我们需要发送 uci
        // 引擎本身在 worker 中已经设置了 onmessage，
        // 但我们需要发送 uci 命令来启动协议协商
        
        // 等待一小段时间让 worker 启动，然后发送 uci
        setTimeout(() => {
          this.sendRaw('uci');
        }, 100);
        
        this.resolveReady = resolve;
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
        
        // 输出最终评估结果
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

  isReady(): boolean { return this.status === 'ready'; }
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
      
      // 安全兜底：超时后强制 resolve
      setTimeout(() => {
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
      
      setTimeout(() => {
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
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.status = 'error';
  }
}

const ENGINE_BASENAME = 'stockfish-17.1-lite-single-03e3232';
let engineInstance: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!engineInstance) {
    engineInstance = new StockfishEngine();
  }
  return engineInstance;
}
