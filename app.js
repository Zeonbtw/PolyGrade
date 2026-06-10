const SAVE_KEY = 'stipend_rows_v2';

let rows = [];
let nextId = 0;

// Security helpers

function sanitizeText(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val.replace(/[<>"'`]/g, '').slice(0, maxLen);
}

function sanitizeNumber(val) {
  if (typeof val !== 'string' && typeof val !== 'number') return '';
  const s = String(val).replace(/[^0-9.\-]/g, '');
  return isNaN(parseFloat(s)) ? '' : s;
}

// Grade helpers

function scoreClass(sc) {
  if (sc >= 88) return 's5';
  if (sc >= 71) return 's4';
  if (sc >= 50) return 's3';
  return 's2';
}

function gradeResult(avg) {
  if (avg >= 88) return { pillId: '5',  colorClass: 'c-green' };
  if (avg >= 71) return { pillId: '4',  colorClass: 'c-blue'  };
  if (avg >= 50) return { pillId: '3',  colorClass: 'c-amber' };
  return             { pillId: '2',  colorClass: 'c-red'   };
}

// Row management

function addRow(data) {
  const id = nextId++;
  rows.push({
    id,
    name:    data?.name    || '',
    credits: data?.credits || '',
    score:   data?.score   || '',
  });
  renderRows();
  if (!data) {
    const el = document.querySelector('#rows .row:last-child .inp-name input');
    if (el) el.focus();
  }
}

function deleteRow(id) {
  rows = rows.filter(r => r.id !== id);
  renderRows();
  save();
}

function onInput(id, field, val) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  row[field] = val;

  if (field === 'score') {
    const wrap = document.getElementById('score-wrap-' + id);
    if (wrap) {
      wrap.className = 'inp-score';
      const sc = parseFloat(val);
      if (!isNaN(sc) && sc >= 0 && sc <= 100) {
        wrap.classList.add(scoreClass(sc));
      }
    }
  }

  calc();
  save();
}

// Validation helpers

function clamp(val, min, max) {
  const n = parseFloat(val);
  if (isNaN(n) || val === '') return val;
  if (n < min) return String(min);
  if (n > max) return String(max);
  return val;
}

function blockNonNumeric(e) {
  const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','.'];
  if (allowed.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (!/[\d.]/.test(e.key)) e.preventDefault();
}

function setScoreError(wrap, hasError) {
  wrap.classList.toggle('inp-error', hasError);
}

// Render

function renderRows() {
  const wrap = document.getElementById('rows');
  wrap.replaceChildren();

  rows.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'row';

    // row number
    const numEl = document.createElement('div');
    numEl.className = 'row-num';
    numEl.textContent = i + 1;

    // name input
    const nameWrap = document.createElement('div');
    nameWrap.className = 'inp-name';
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.placeholder = 'Назва предмета';
    nameInp.maxLength = 100;
    nameInp.value = r.name;
    nameInp.addEventListener('input', () => onInput(r.id, 'name', nameInp.value));
    nameWrap.appendChild(nameInp);

    // credits input
    const credWrap = document.createElement('div');
    credWrap.className = 'inp-credits';
    const credInp = document.createElement('input');
    credInp.type = 'number';
    credInp.placeholder = '3';
    credInp.min = '0.5';
    credInp.max = '30';
    credInp.step = '0.5';
    credInp.value = r.credits;
    credInp.addEventListener('keydown', blockNonNumeric);
    credInp.addEventListener('input', () => onInput(r.id, 'credits', credInp.value));
    credInp.addEventListener('blur', () => {
      const v = clamp(credInp.value, 0.5, 30);
      if (v !== credInp.value) { credInp.value = v; onInput(r.id, 'credits', v); }
    });
    credWrap.appendChild(credInp);

    // score input
    const scoreWrap = document.createElement('div');
    scoreWrap.className = 'inp-score';
    scoreWrap.id = 'score-wrap-' + r.id;
    const scoreInp = document.createElement('input');
    scoreInp.type = 'number';
    scoreInp.placeholder = '85';
    scoreInp.min = '0';
    scoreInp.max = '100';
    scoreInp.step = '1';
    scoreInp.value = r.score;
    scoreInp.addEventListener('keydown', blockNonNumeric);
    scoreInp.addEventListener('input', () => {
      const raw = parseFloat(scoreInp.value);
      setScoreError(scoreWrap, !isNaN(raw) && (raw < 0 || raw > 100));
      onInput(r.id, 'score', scoreInp.value);
    });
    scoreInp.addEventListener('blur', () => {
      const v = clamp(scoreInp.value, 0, 100);
      if (v !== scoreInp.value) { scoreInp.value = v; onInput(r.id, 'score', v); }
      setScoreError(scoreWrap, false);
    });
    scoreWrap.appendChild(scoreInp);

    // delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.title = 'Видалити';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteRow(r.id));

    div.appendChild(numEl);
    div.appendChild(nameWrap);
    div.appendChild(credWrap);
    div.appendChild(scoreWrap);
    div.appendChild(delBtn);
    wrap.appendChild(div);

    // apply score color on initial render
    const sc = parseFloat(r.score);
    if (!isNaN(sc) && sc >= 0 && sc <= 100) {
      scoreWrap.classList.add(scoreClass(sc));
    }
  });

  calc();
}

// Calculate

function calc() {
  const valid = rows
    .filter(r => {
      const cr = parseFloat(r.credits);
      const sc = parseFloat(r.score);
      return !isNaN(cr) && !isNaN(sc) && cr > 0 && sc >= 0 && sc <= 100;
    })
    .map(r => ({
      cr:   parseFloat(r.credits),
      sc:   parseFloat(r.score),
      name: r.name,
    }));

  const scoreEl   = document.getElementById('result-score');
  const formulaEl = document.getElementById('result-formula');

  // stats
  document.getElementById('stat-subjects').textContent = valid.length;
  const totalCr = valid.reduce((s, v) => s + v.cr, 0);
  document.getElementById('stat-credits').textContent =
    totalCr % 1 === 0 ? totalCr : totalCr.toFixed(1);

  // reset pills and score color
  ['5', '4', '3', '2'].forEach(k =>
    document.getElementById('pill-' + k).classList.remove('active')
  );
  scoreEl.className = 'result-score';

  if (!valid.length) {
    scoreEl.textContent = '—';
    formulaEl.textContent = '';
    document.getElementById('stat-simple').textContent = '—';
    document.getElementById('stat-five').textContent = '—';
    document.getElementById('copy-btn').disabled = true;
    return;
  }

  const weighted  = valid.reduce((s, v) => s + v.sc * v.cr, 0);
  const avg       = weighted / totalCr;
  const simpleAvg = valid.reduce((s, v) => s + v.sc, 0) / valid.length;

  scoreEl.textContent = avg.toFixed(2);
  document.getElementById('stat-simple').textContent = simpleAvg.toFixed(2);

  const toFive = sc => sc >= 88 ? 5 : sc >= 71 ? 4 : sc >= 50 ? 3 : 2;
  const fiveAvg = valid.reduce((s, v) => s + toFive(v.sc), 0) / valid.length;
  const fiveEl = document.getElementById('stat-five');
  fiveEl.textContent = fiveAvg.toFixed(2);
  fiveEl.className = 'stat-val' +
    (fiveAvg >= 4.5 ? ' c-green' : fiveAvg >= 3.5 ? ' c-blue' : fiveAvg >= 2.5 ? ' c-amber' : ' c-red');

  const { pillId, colorClass } = gradeResult(avg);
  document.getElementById('pill-' + pillId).classList.add('active');
  scoreEl.classList.add(colorClass);
  document.getElementById('copy-btn').disabled = false;

  const parts = valid
    .map(v => `${v.sc.toFixed(0)}x${v.cr % 1 === 0 ? v.cr : v.cr.toFixed(1)}`)
    .join(' + ');
  formulaEl.textContent =
    `(${parts}) / ${totalCr % 1 === 0 ? totalCr : totalCr.toFixed(1)} = ${avg.toFixed(4)}`;
}

// Persist

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(
    rows.map(r => ({ name: r.name, credits: r.credits, score: r.score }))
  ));
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { addRow(); return; }
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) { addRow(); return; }
    const clean = saved
      .slice(0, 50)
      .filter(r => r && typeof r === 'object')
      .map(r => ({
        name:    sanitizeText(r.name, 100),
        credits: sanitizeNumber(r.credits),
        score:   sanitizeNumber(r.score),
      }));
    if (clean.length) { clean.forEach(addRow); return; }
  } catch (e) {
    localStorage.removeItem(SAVE_KEY);
  }
  addRow();
}

// ── PDF Import ────────────────────────────────────────────────

function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast toast-' + type + ' toast-visible';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

async function parsePDF(file) {
  const PDFJS = window['pdfjs-dist/build/pdf'];
  PDFJS.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const buf = await file.arrayBuffer();
  const pdf = await PDFJS.getDocument({ data: buf }).promise;

  // Collect every text item with its position
  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      const s = item.str.replace(/\s+/g, ' ').trim();
      if (s) allItems.push({ str: s, x: item.transform[4], y: item.transform[5] });
    }
  }

  // Sort top-to-bottom, then left-to-right
  allItems.sort((a, b) => b.y - a.y || a.x - b.x);

  // Group into visual lines (items within 4pt vertically)
  const lines = [];
  for (const item of allItems) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(item.y - last.baseY) < 4) {
      last.items.push(item);
    } else {
      lines.push({ baseY: item.y, items: [item] });
    }
  }

  // Find the header line that contains both "ЄКТС" (credits) and "100" (grade)
  let creditsX = null, scoreX = null, headerEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const strs = lines[i].items.map(it => it.str);
    if (strs.some(s => s.includes('ЄКТС'))) {
      creditsX = lines[i].items.find(it => it.str.includes('ЄКТС')).x;
    }
    if (strs.includes('100') && creditsX !== null) {
      scoreX = lines[i].items.find(it => it.str === '100').x;
      headerEndIdx = i;
      break;
    }
  }

  if (creditsX === null || scoreX === null) return null;

  const TOL = 12; // pt tolerance for column matching
  const subjects = [];

  for (let i = headerEndIdx + 1; i < lines.length; i++) {
    const { items } = lines[i];
    const credItem  = items.find(it => Math.abs(it.x - creditsX) < TOL);
    const scoreItem = items.find(it => Math.abs(it.x - scoreX)   < TOL);

    if (credItem && scoreItem) {
      const credits = parseFloat(credItem.str);
      const score   = parseFloat(scoreItem.str);
      // Left-side items are the subject name (before the credits column)
      const name = items
        .filter(it => it.x < creditsX - 20)
        .map(it => it.str)
        .join(' ')
        .trim();

      if (!isNaN(credits) && !isNaN(score) && name) {
        subjects.push({ name, credits: String(credits), score: String(score) });
      }
    } else {
      // Continuation of previous subject name (multi-line cell)
      const leftParts = items
        .filter(it => it.x < creditsX - 20)
        .map(it => it.str);
      if (leftParts.length && subjects.length > 0) {
        subjects[subjects.length - 1].name =
          (subjects[subjects.length - 1].name + ' ' + leftParts.join(' ')).trim();
      }
    }
  }

  return subjects.length ? subjects : null;
}

document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('pdf-input').click();
});

document.getElementById('pdf-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.textContent = 'Зчитую…';

  try {
    const subjects = await parsePDF(file);
    if (!subjects) {
      showToast('Не вдалося розпізнати таблицю оцінок у цьому PDF', 'err');
      return;
    }
    // Clear existing rows, load imported ones
    rows = [];
    nextId = 0;
    subjects.forEach(addRow);
    save();
    showToast(`Імпортовано ${subjects.length} предмет${subjects.length === 1 ? '' : subjects.length < 5 ? 'и' : 'ів'} ✓`);
  } catch (err) {
    console.error(err);
    showToast('Помилка читання PDF', 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Імпорт PDF`;
  }
});

// ── Event listeners ───────────────────────────────────────────

document.getElementById('add-btn').addEventListener('click', () => addRow());

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!confirm('Видалити всі предмети?')) return;
  rows = [];
  renderRows();
  addRow();
  save();
});

// Init

load();
// Telegram button

function openTelegram() {
  var t = Date.now();
  location.href = 'tg://resolve?domain=zeonbtvv';
  setTimeout(function () {
    if (Date.now() - t < 1600) window.open('https://t.me/zeonbtvv', '_blank');
  }, 1500);
}

// Copy result

function copyResult() {
  const score = document.getElementById('result-score').textContent.trim();
  if (!score || score === '—') return;

  const subjects = document.getElementById('stat-subjects').textContent;
  const credits  = document.getElementById('stat-credits').textContent;
  const simple   = document.getElementById('stat-simple').textContent;
  const formula  = document.getElementById('result-formula').textContent;

  const activeGrade = ['5','4','3','2'].find(k =>
    document.getElementById('pill-' + k).classList.contains('active')
  );
  const gradeLabel = activeGrade ? `Оцінка: ${activeGrade}` : '';

  const five = document.getElementById('stat-five').textContent;

  const lines = [
    '📊 Мій стипендійний бал — PolyGrade',
    '─────────────────────',
    `🎯 Бал: ${score}`,
    gradeLabel,
    `📚 Предметів: ${subjects}  |  Кредитів: ${credits}`,
    `∑ Просте середнє: ${simple}`,
    `★ Середнє (5-бальна): ${five}`,
    formula ? `\nФормула: ${formula}` : '',
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(lines).then(function () {
    const btn  = document.getElementById('copy-btn');
    const text = btn.querySelector('.copy-text');
    text.textContent = 'Скопійовано ✓';
    btn.classList.add('copied');
    setTimeout(function () {
      text.textContent = 'Скопіювати результат';
      btn.classList.remove('copied');
    }, 2000);
  });
}