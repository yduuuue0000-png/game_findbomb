import './style.css';
import { DIFFICULTIES, Minesweeper, calcScore } from './game.js';
import { isConfigured, saveScore, fetchLeaderboard, fetchReviews, addReview } from './supabase.js';

const $ = (sel) => document.querySelector(sel);

// ───────── 닉네임 저장 (브라우저별 편의 기능) ─────────
const NICK_KEY = 'findbomb:nickname';
function getNick() {
  try {
    return localStorage.getItem(NICK_KEY) || '';
  } catch {
    return '';
  }
}
function setNick(v) {
  try {
    localStorage.setItem(NICK_KEY, v);
  } catch {}
}

function errMsg(err) {
  return err?.message || String(err);
}

function pad3(n) {
  return n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0');
}

// ───────── 화면 전환 ─────────
function show(name) {
  if (name !== 'game') stopTimer();
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  window.scrollTo(0, 0);
  if (name === 'start') $('#nickname').value = getNick();
  if (name === 'rank') loadRank();
  if (name === 'review') openReview();
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) show(nav.dataset.nav);
});

$('#config-warning').hidden = isConfigured;

// ───────── 시작 화면 ─────────
const startForm = $('#start-form');
$('#nickname').value = getNick();

startForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nick = $('#nickname').value.trim();
  if (!nick) {
    $('#nickname').focus();
    return;
  }
  setNick(nick);
  startGame(nick, new FormData(startForm).get('difficulty'));
});

// ───────── 게임 ─────────
const boardEl = $('#board');
let game = null;
let current = { nick: '', difficulty: 'easy' };
let gameToken = 0;
let timerId = null;
let startedAt = 0;
let elapsed = 0;
let flagMode = false;

function startGame(nick, difficulty) {
  current = { nick, difficulty };
  game = new Minesweeper(DIFFICULTIES[difficulty]);
  gameToken++;
  stopTimer();
  startedAt = 0;
  elapsed = 0;
  $('#game-info').textContent = `${nick} · ${DIFFICULTIES[difficulty].label}`;
  $('#result').hidden = true;
  buildBoard();
  render();
  show('game');
}

function buildBoard() {
  boardEl.style.setProperty('--cols', game.cols);
  boardEl.dataset.size = current.difficulty;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < game.size; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell';
    b.dataset.i = i;
    frag.appendChild(b);
  }
  boardEl.replaceChildren(frag);
}

function render() {
  const cells = boardEl.children;
  const lost = game.state === 'lost';
  for (let i = 0; i < game.size; i++) {
    let cls = 'cell';
    let txt = '';
    if (game.revealed[i]) {
      cls += ' open';
      if (game.mine[i]) {
        cls += i === game.explodedIdx ? ' mine exploded' : ' mine';
        txt = '💣';
      } else if (game.adj[i]) {
        cls += ` n${game.adj[i]}`;
        txt = game.adj[i];
      }
    } else if (game.flag[i]) {
      if (lost && !game.mine[i]) {
        cls += ' open wrong';
        txt = '❌';
      } else {
        cls += ' flag';
        txt = '🚩';
      }
    } else if (lost && game.mine[i]) {
      cls += ' open mine';
      txt = '💣';
    }
    cells[i].className = cls;
    cells[i].textContent = txt;
  }
  $('#mines-left').textContent = pad3(game.mineCount - game.flagCount);
  $('#timer').textContent = pad3(elapsed);
  $('#face').textContent = game.state === 'won' ? '😎' : lost ? '😵' : '🙂';
}

function tick() {
  elapsed = Math.min(999, Math.floor((Date.now() - startedAt) / 1000));
  $('#timer').textContent = pad3(elapsed);
}

function startTimer() {
  startedAt = Date.now();
  timerId = setInterval(tick, 250);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function act(i, kind) {
  if (!game || game.isOver()) return;
  const before = game.state;
  if (kind === 'flag') game.toggleFlag(i);
  else if (game.revealed[i]) game.chord(i);
  else game.reveal(i);
  if (before === 'ready' && game.state !== 'ready') startTimer();
  if (game.isOver()) {
    stopTimer();
    tick();
  }
  render();
  if (game.isOver()) finish();
}

async function finish() {
  const token = gameToken;
  const won = game.state === 'won';
  const { nick, difficulty } = current;
  const score = calcScore({ difficulty, revealed: game.safeOpened, won, seconds: elapsed });

  $('#result').hidden = false;
  $('#result').classList.toggle('won', won);
  $('#result-title').textContent = won ? '🎉 승리!' : '💥 지뢰를 밟았습니다';
  $('#result-detail').textContent = `점수 ${score.toLocaleString()}점 · ${elapsed}초 · 연 칸 ${game.safeOpened}/${game.size - game.mineCount}`;
  const saveEl = $('#result-save');

  if (!isConfigured) {
    saveEl.textContent = '⚠️ Supabase가 설정되지 않아 점수를 저장하지 못했습니다.';
    return;
  }
  saveEl.textContent = '점수 저장 중…';
  try {
    await saveScore({
      nickname: nick,
      difficulty,
      won,
      time_seconds: elapsed,
      revealed_cells: game.safeOpened,
      score,
    });
    if (token === gameToken) saveEl.textContent = '✅ 점수가 저장되었습니다.';
  } catch (err) {
    if (token === gameToken) saveEl.textContent = `⚠️ 저장 실패: ${errMsg(err)}`;
  }
}

// 입력: 클릭=열기, 우클릭=깃발, 터치 길게 누르기=깃발
let pressTimer = null;
let pressStart = null;
let suppressClick = false;
let lastPointer = 'mouse';

boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  act(Number(cell.dataset.i), flagMode ? 'flag' : 'open');
});

boardEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (lastPointer === 'touch') return; // 터치는 길게 누르기 타이머가 처리
  const cell = e.target.closest('.cell');
  if (cell) act(Number(cell.dataset.i), 'flag');
});

boardEl.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType;
  suppressClick = false;
  if (e.pointerType !== 'touch') return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  pressStart = { x: e.clientX, y: e.clientY };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    suppressClick = true;
    act(Number(cell.dataset.i), flagMode ? 'open' : 'flag');
    navigator.vibrate?.(30);
  }, 400);
});

boardEl.addEventListener('pointermove', (e) => {
  if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) clearTimeout(pressTimer);
});

for (const type of ['pointerup', 'pointercancel']) {
  boardEl.addEventListener(type, () => {
    clearTimeout(pressTimer);
    pressStart = null;
  });
}

$('#face').addEventListener('click', () => startGame(current.nick, current.difficulty));
$('#btn-retry').addEventListener('click', () => startGame(current.nick, current.difficulty));

$('#flag-toggle').addEventListener('click', (e) => {
  flagMode = !flagMode;
  e.currentTarget.setAttribute('aria-pressed', String(flagMode));
  e.currentTarget.textContent = `🚩 깃발 모드: ${flagMode ? '켬' : '끔'}`;
});

// ───────── 랭킹 ─────────
let rankDiff = 'easy';

document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    rankDiff = tab.dataset.diff;
    loadRank();
  }),
);

function rankMessage(text) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 6;
  td.className = 'empty';
  td.textContent = text;
  tr.appendChild(td);
  $('#rank-body').replaceChildren(tr);
}

async function loadRank() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.diff === rankDiff));
  if (!isConfigured) return rankMessage('Supabase가 설정되지 않았습니다.');
  const diff = rankDiff;
  rankMessage('불러오는 중…');
  try {
    const rows = await fetchLeaderboard(diff);
    if (diff !== rankDiff) return;
    if (!rows.length) return rankMessage('아직 기록이 없습니다. 첫 번째 기록의 주인공이 되어보세요!');
    const me = getNick();
    const trs = rows.map((r, idx) => {
      const tr = document.createElement('tr');
      if (r.nickname === me) tr.className = 'me';
      const medal = ['🥇', '🥈', '🥉'][idx] ?? idx + 1;
      const cols = [
        medal,
        r.nickname,
        r.score.toLocaleString(),
        r.won ? '승리' : '패배',
        `${r.time_seconds}초`,
        new Date(r.created_at).toLocaleDateString('ko-KR'),
      ];
      for (const c of cols) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      return tr;
    });
    $('#rank-body').replaceChildren(...trs);
  } catch (err) {
    if (diff === rankDiff) rankMessage(`불러오기 실패: ${errMsg(err)}`);
  }
}

// ───────── 리뷰 ─────────
let rating = 0;
const starBtns = [...document.querySelectorAll('#stars button')];

function paintStars() {
  starBtns.forEach((b) => {
    const on = Number(b.dataset.v) <= rating;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(Number(b.dataset.v) === rating));
  });
}
starBtns.forEach((b) =>
  b.addEventListener('click', () => {
    rating = Number(b.dataset.v);
    paintStars();
  }),
);

$('#review-content').addEventListener('input', (e) => {
  $('#review-count').textContent = `${e.target.value.length}/500`;
});

function openReview() {
  if (!$('#review-nickname').value) $('#review-nickname').value = getNick();
  loadReviews();
}

$('#review-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#review-status');
  const nickname = $('#review-nickname').value.trim();
  const content = $('#review-content').value.trim();
  if (!nickname || !content) return;
  if (!rating) {
    status.textContent = '별점을 선택해주세요.';
    return;
  }
  if (!isConfigured) {
    status.textContent = '⚠️ Supabase가 설정되지 않아 리뷰를 저장할 수 없습니다.';
    return;
  }
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  status.textContent = '등록 중…';
  try {
    await addReview({ nickname, rating, content });
    setNick(nickname);
    $('#review-content').value = '';
    $('#review-count').textContent = '0/500';
    rating = 0;
    paintStars();
    status.textContent = '✅ 리뷰가 등록되었습니다. 감사합니다!';
    loadReviews();
  } catch (err) {
    status.textContent = `⚠️ 등록 실패: ${errMsg(err)}`;
  } finally {
    submitBtn.disabled = false;
  }
});

function reviewMessage(text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  $('#review-list').replaceChildren(li);
}

async function loadReviews() {
  const summary = $('#review-summary');
  summary.textContent = '';
  if (!isConfigured) return reviewMessage('Supabase가 설정되지 않았습니다.');
  reviewMessage('불러오는 중…');
  try {
    const rows = await fetchReviews();
    if (!rows.length) return reviewMessage('아직 리뷰가 없습니다. 첫 리뷰를 남겨주세요!');
    const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    summary.textContent = `평균 ★ ${avg.toFixed(1)} · 최근 리뷰 ${rows.length}개`;
    const items = rows.map((r) => {
      const li = document.createElement('li');
      li.className = 'card review';
      const head = document.createElement('div');
      head.className = 'review-head';
      const name = document.createElement('b');
      name.textContent = r.nickname;
      const stars = document.createElement('span');
      stars.className = 'review-stars';
      stars.textContent = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const date = document.createElement('small');
      date.className = 'muted';
      date.textContent = new Date(r.created_at).toLocaleString('ko-KR');
      head.append(name, stars, date);
      const body = document.createElement('p');
      body.textContent = r.content;
      li.append(head, body);
      return li;
    });
    $('#review-list').replaceChildren(...items);
  } catch (err) {
    reviewMessage(`불러오기 실패: ${errMsg(err)}`);
  }
}
