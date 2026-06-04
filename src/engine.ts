/**
 * Stockfish WASM 引擎封装
 * UCI 协议适配，支持 AI 走棋计算和局面分析
 */

export type EvalResult = {
  move: string;
  score: number | null;
  mate: number | null;
  depth: number;
  multipv: number;
};

export type EngineStatus = 'loading' | 'ready' | 'thinking' | 'idle' | 'error';

type EngineListener = {
  onReady?: () => void;
  onBestMove?: (bestMove: string, ponder: string) => void;
  onInfo?: (info: string) => void;
  onEval?: (evals: EvalResult[]) => void;
  onError?: (err: string) => void;
};

const ENGINE_BASENAME = 'stockfish-17.1-lite-single-03e3232';

class StockfishEngine {
  private engine: any = null;
  private status: EngineStatus = 'loading';
  private listeners: EngineListener[] = [];
  private buffer = '';
  private evalResults: EvalResult[] = [];
  private currentMultipv = 1;
  private pendingCmds: string[] = [];

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const engine = {} as any;
      
      // Set up locateFile to find WASM parts in /assets/
      engine.locateFile = (path: string) => {
        if (path.endsWith('.wasm') || path.endsWith('.wasm.map')) {
          const filename = path.split('/').pop() || path;
          return `/assets/${filename}`;
        }
        return `/assets/${ENGINE_BASENAME}.js`;
      };

      let resolved = false;

      const script = document.createElement('script');
      script.src = `/assets/${ENGINE_BASENAME}.js`;
      script.onload = () => {
        if (typeof (window as any).Stockfish === 'function') {
          const INIT_ENGINE = (window as any).Stockfish;
          const enginePromise = INIT_ENGINE();

          let initAttempts = 0;
          const checkReady = () => {
            initAttempts++;
            if (initAttempts > 200) {
              reject(new Error('引擎初始化超时'));
              return;
            }
            
            if (engine._isReady && engine._isReady()) {
              delete engine._isReady;
              this.engine = engine;
              this.setupEngine();
              if (!resolved) {
                resolved = true;
                resolve();
              }
            } else {
              setTimeout(checkReady, 50);
            }
          };

          enginePromise.then((sf: any) => {
            Object.assign(engine, sf);
            checkReady();
          }).catch((e: any) => {
            if (!resolved) { resolved = true; reject(e); }
          });
        } else {
          reject(new Error('Stockfish 构造函数未找到'));
        }
      };
      script.onerror = () => reject(new Error('Stockfish WASM 加载失败'));
      document.head.appendChild(script);
    });
  }

  private setupEngine() {
    // 设置输出监听
    this.engine.print = (line: string) => this.handleOutput(line);
    this.engine.println = (line: string) => this.handleOutput(line);
    
    // 初始化 UCI
    this.send('uci');
    this.send('setoption name MultiPV value 1');
    this.send('setoption name UCI_LimitStrength value true');
    this.status = 'ready';
  }

  private handleOutput(line: string) {
    // 解析引擎输出
    if (line.startsWith('info')) {
      this.currentMultipv = 1;
      const pvMatch = line.match(/multipv\s+(\d+)/);
      if (pvMatch) this.currentMultipv = parseInt(pvMatch[1]);
      
      const currMove = line.match(/currmove\s+\S+/);
      if (currMove) return;
      
      const evalEntry: EvalResult = {
        multipv: this.currentMultipv,
        depth: 0,
        score: null,
        mate: null,
        move: ''
      };
      
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
      
      this.listeners.forEach(l => l.onInfo?.(line));
    }
    
    if (line.startsWith('bestmove')) {
      const bestMatch = line.match(/bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
      if (bestMatch) {
        const bestMove = bestMatch[1];
        const ponder = bestMatch[2] || '';
        this.listeners.forEach(l => l.onBestMove?.(bestMove, ponder));
        
        const sortedEvals = [...this.evalResults]
          .filter(e => e.depth > 0)
          .sort((a, b) => b.depth - a.depth)
          .slice(0, 3);
        
        if (sortedEvals.length > 0) {
          this.listeners.forEach(l => l.onEval?.(sortedEvals));
        }
      }
    }
    
    this.buffer += line + '\n';
  }

  getStatus(): EngineStatus { return this.status; }
  isReady(): boolean { return this.status === 'ready'; }
  isThinking(): boolean { return this.status === 'thinking'; }

  send(cmd: string) {
    if (!this.engine) return;
    this.engine.sendCommand(cmd);
  }

  setPosition(fen: string, moves: string[] = []) {
    const posCmd = moves.length > 0
      ? `position fen ${fen} moves ${moves.join(' ')}`
      : `position fen ${fen}`;
    this.send(posCmd);
  }

  setStartPosition(moves: string[] = []) {
    const posCmd = moves.length > 0
      ? `position startpos moves ${moves.join(' ')}`
      : 'position startpos';
    this.send(posCmd);
  }

  calculateBestMove(level: number = 5, timeMs: number = 1000): Promise<EvalResult[]> {
    return new Promise((resolve) => {
      this.status = 'thinking';
      this.evalResults = [];
      
      const timeoutId = setTimeout(() => {
        this.cleanupListener(listener);
        this.status = 'idle';
        resolve(this.evalResults.length > 0 ? this.evalResults : []);
      }, timeMs + 3000);
      
      const listener: EngineListener = {
        onEval: (evals) => {
          clearTimeout(timeoutId);
          this.cleanupListener(listener);
          this.status = 'idle';
          resolve(evals);
        },
        onBestMove: (move) => {
          if (this.status === 'thinking') {
            clearTimeout(timeoutId);
            this.cleanupListener(listener);
            this.status = 'idle';
            resolve(this.evalResults.length > 0 ? this.evalResults : [{
              move, score: null, mate: null, depth: 0, multipv: 1
            }]);
          }
        }
      };
      
      this.addListener(listener);
      this.setDifficulty(level);
      this.send(`go movetime ${timeMs}`);
    });
  }

  analyzePosition(level: number = 10, timeMs: number = 2000): Promise<EvalResult[]> {
    return new Promise((resolve) => {
      this.status = 'thinking';
      this.evalResults = [];
      
      this.send('setoption name MultiPV value 3');
      
      const timeoutId = setTimeout(() => {
        this.cleanupListener(listener);
        this.status = 'idle';
        this.send('setoption name MultiPV value 1');
        resolve(this.evalResults.length > 0 ? this.evalResults : []);
      }, timeMs + 3000);
      
      const listener: EngineListener = {
        onEval: (evals) => {
          clearTimeout(timeoutId);
          this.cleanupListener(listener);
          this.status = 'idle';
          this.send('setoption name MultiPV value 1');
          resolve(evals);
        },
        onBestMove: () => {
          if (this.status === 'thinking') {
            clearTimeout(timeoutId);
            this.cleanupListener(listener);
            this.status = 'idle';
            this.send('setoption name MultiPV value 1');
            resolve(this.evalResults.length > 0 ? this.evalResults : []);
          }
        }
      };
      
      this.addListener(listener);
      this.setDifficulty(level);
      this.send(`go movetime ${timeMs}`);
    });
  }

  private setDifficulty(level: number) {
    const elo = Math.round(1320 + (level - 1) / 9 * (3190 - 1320));
    this.send(`setoption name UCI_LimitStrength value true`);
    this.send(`setoption name UCI_Elo value ${Math.min(3190, Math.max(1320, elo))}`);
  }

  stop() {
    if (this.status === 'thinking') {
      this.send('stop');
      this.status = 'idle';
    }
  }

  addListener(l: EngineListener) {
    this.listeners.push(l);
  }

  private cleanupListener(l: EngineListener) {
    this.listeners = this.listeners.filter(L => L !== l);
  }

  terminate() {
    if (this.engine?.terminate) {
      this.engine.terminate();
    }
    this.engine = null;
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
