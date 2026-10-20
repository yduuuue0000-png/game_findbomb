export const DIFFICULTIES = {
  easy: { label: '초급', rows: 9, cols: 9, mines: 10, mult: 1 },
  medium: { label: '중급', rows: 16, cols: 16, mines: 40, mult: 3 },
  hard: { label: '고급', rows: 16, cols: 30, mines: 99, mult: 6 },
};

// 점수 = (연 칸 수 × 10 + 승리 시 시간 보너스) × 난이도 배율
export function calcScore({ difficulty, revealed, won, seconds }) {
  const { mult } = DIFFICULTIES[difficulty];
  const bonus = won ? Math.max(0, 1000 - seconds * 5) : 0;
  return (revealed * 10 + bonus) * mult;
}

export class Minesweeper {
  constructor({ rows, cols, mines }) {
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mines;
    this.size = rows * cols;
    this.mine = new Array(this.size).fill(false);
    this.adj = new Array(this.size).fill(0);
    this.revealed = new Array(this.size).fill(false);
    this.flag = new Array(this.size).fill(false);
    this.safeOpened = 0;
    this.flagCount = 0;
    this.state = 'ready'; // ready | playing | won | lost
    this.explodedIdx = -1;
  }

  isOver() {
    return this.state === 'won' || this.state === 'lost';
  }

  neighbors(i) {
    const r = Math.floor(i / this.cols);
    const c = i % this.cols;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) out.push(nr * this.cols + nc);
      }
    }
    return out;
  }

  // 첫 클릭한 칸과 그 주변에는 지뢰를 두지 않는다
  placeMines(safeIdx) {
    const forbidden = new Set([safeIdx, ...this.neighbors(safeIdx)]);
    const pool = [];
    for (let i = 0; i < this.size; i++) if (!forbidden.has(i)) pool.push(i);
    for (let k = 0; k < this.mineCount; k++) {
      const j = k + Math.floor(Math.random() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
      this.mine[pool[k]] = true;
    }
    for (let i = 0; i < this.size; i++) {
      this.adj[i] = this.neighbors(i).filter((n) => this.mine[n]).length;
    }
  }

  reveal(i) {
    if (this.isOver() || this.flag[i] || this.revealed[i]) return;
    if (this.state === 'ready') {
      this.placeMines(i);
      this.state = 'playing';
    }
    if (this.mine[i]) {
      this.revealed[i] = true;
      this.explodedIdx = i;
      this.state = 'lost';
      return;
    }
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop();
      if (this.revealed[cur] || this.flag[cur]) continue;
      this.revealed[cur] = true;
      this.safeOpened++;
      if (this.adj[cur] === 0) {
        for (const n of this.neighbors(cur)) if (!this.revealed[n] && !this.mine[n]) stack.push(n);
      }
    }
    if (this.safeOpened === this.size - this.mineCount) this.win();
  }

  // 숫자 칸을 누르면, 주변 깃발 수가 숫자와 같을 때 나머지 칸을 한 번에 연다
  chord(i) {
    if (this.isOver() || !this.revealed[i] || this.adj[i] === 0) return;
    const ns = this.neighbors(i);
    if (ns.filter((n) => this.flag[n]).length !== this.adj[i]) return;
    for (const n of ns) {
      this.reveal(n);
      if (this.isOver()) return;
    }
  }

  toggleFlag(i) {
    if (this.isOver() || this.revealed[i]) return;
    this.flag[i] = !this.flag[i];
    this.flagCount += this.flag[i] ? 1 : -1;
  }

  win() {
    this.state = 'won';
    for (let i = 0; i < this.size; i++) {
      if (this.mine[i] && !this.flag[i]) {
        this.flag[i] = true;
        this.flagCount++;
      }
    }
  }
}
