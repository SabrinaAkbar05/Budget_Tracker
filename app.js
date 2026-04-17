/* ══════════════════════════════════════════
   FlowBudget — app.js
   Features: add/edit/delete entries, filter,
   search, charts, dark mode, monthly summary,
   local storage persistence.
   ══════════════════════════════════════════ */

// ── 1. State ──────────────────────────────
let entries    = JSON.parse(localStorage.getItem('budget_entries')) || [];
let currentFilter = 'all';
let editingId  = null;
let searchQuery = '';
let currentView = 'dashboard';

// ── 2. Categories ─────────────────────────
const categories = {
    income:  ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Bonus', 'Other'],
    expense: ['Food', 'Transport', 'Utilities', 'Shopping', 'Health', 'Education', 'Entertainment', 'Rent', 'Travel', 'Other']
};

// Category icons map
const catIcons = {
    Salary: '💼', Freelance: '💻', Business: '🏢', Investment: '📈',
    Gift: '🎁', Bonus: '⭐', Food: '🍜', Transport: '🚗', Utilities: '⚡',
    Shopping: '🛍️', Health: '❤️', Education: '📚', Entertainment: '🎬',
    Rent: '🏠', Travel: '✈️', Other: '◈'
};

// ── 3. DOM Refs ───────────────────────────
const form = {
    label:     document.getElementById('f-label'),
    amount:    document.getElementById('f-amount'),
    type:      document.getElementById('f-type'),
    cat:       document.getElementById('f-cat'),
    date:      document.getElementById('f-date'),
    title:     document.getElementById('form-title'),
    submitBtn: document.getElementById('submit-btn'),
    cancelBtn: document.getElementById('cancel-btn')
};

// ── 4. Init ───────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    setupCategories();
    form.date.value = todayStr();

    // Populate chart month selector
    populateMonthSelect();

    // Initial render
    renderAll();
    setupNavigation();
    setupSearch();
    setupTheme();
    setupModal();
    setupFilters();
    setupHamburger();
    setupChartMonthChange();
});

// ── 5. Utilities ──────────────────────────
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function save() {
    localStorage.setItem('budget_entries', JSON.stringify(entries));
}

function formatPKR(n) {
    return 'PKR ' + Math.abs(n).toLocaleString();
}

function getMonthKey(dateStr) {
    // e.g. "2024-06" from "2024-06-15"
    return dateStr ? dateStr.slice(0, 7) : '';
}

function monthLabel(key) {
    if (!key) return '';
    const [y, m] = key.split('-');
    return new Date(+y, +m - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
}

// ── 6. Category Dropdown ──────────────────
function setupCategories() {
    updateCatDropdown(form.type.value);
    form.type.addEventListener('change', () => updateCatDropdown(form.type.value));
}

function updateCatDropdown(type) {
    const cats = categories[type] || [...categories.income, ...categories.expense];
    form.cat.innerHTML = cats.map(c => `<option value="${c}">${catIcons[c] || '◈'} ${c}</option>`).join('');
}

// ── 7. Navigation ─────────────────────────
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.querySelectorAll('.link-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
}

function switchView(viewId) {
    currentView = viewId;

    // Update nav highlight
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.view === viewId);
    });

    // Show/hide views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === 'view-' + viewId);
    });

    // Update topbar title
    const titles = {
        dashboard: ['Dashboard', 'Track your financial flow'],
        entries:   ['All Entries', 'View and manage your transactions'],
        analytics: ['Analytics', 'Insights into your spending']
    };
    document.getElementById('page-title').textContent = titles[viewId]?.[0] || '';
    document.getElementById('page-sub').textContent   = titles[viewId]?.[1] || '';

    // Draw charts when switching to views that need them
    if (viewId === 'dashboard') drawBarChart();
    if (viewId === 'analytics') drawTrendChart();

    // Close sidebar on mobile
    document.querySelector('.sidebar').classList.remove('open');

    renderAll();
}

// ── 8. Search ─────────────────────────────
function setupSearch() {
    document.getElementById('search-input').addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderAll();
    });
}

// ── 9. Theme Toggle ───────────────────────
function setupTheme() {
    const savedTheme = localStorage.getItem('budget_theme') || 'dark';
    applyTheme(savedTheme);

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('budget_theme', theme);
    document.getElementById('theme-icon').textContent  = theme === 'dark' ? '☀' : '☾';
    document.getElementById('theme-label').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    // Redraw charts with new theme colours
    setTimeout(() => { drawBarChart(); drawDonutChart(); drawTrendChart(); }, 50);
}

// ── 10. Modal ─────────────────────────────
function setupModal() {
    const overlay  = document.getElementById('modal-overlay');
    const openBtn  = document.getElementById('open-modal-btn');
    const closeBtn = document.getElementById('modal-close');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    form.cancelBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal();
    });

    form.submitBtn.addEventListener('click', handleSubmit);
}

function openModal(prefill = null) {
    document.getElementById('modal-overlay').classList.add('open');
    if (!prefill) {
        form.title.textContent = 'New Entry';
        form.submitBtn.textContent = 'Add Entry';
        clearForm();
    }
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    editingId = null;
    form.submitBtn.textContent = 'Add Entry';
    form.title.textContent = 'New Entry';
    clearForm();
}

function clearForm() {
    form.label.value  = '';
    form.amount.value = '';
    form.date.value   = todayStr();
    form.type.value   = 'income';
    updateCatDropdown('income');
}

// ── 11. Submit (Add / Edit) ───────────────
function handleSubmit() {
    const label    = form.label.value.trim();
    const amount   = parseFloat(form.amount.value);
    const type     = form.type.value;
    const category = form.cat.value;
    const date     = form.date.value;

    if (!label || isNaN(amount) || amount <= 0 || !date) {
        shakeModal();
        return;
    }

    const entry = { id: editingId || Date.now().toString(), label, amount, type, category, date };

    if (editingId) {
        const idx = entries.findIndex(e => e.id === editingId);
        entries[idx] = entry;
    } else {
        entries.unshift(entry); // newest first
    }

    save();
    closeModal();
    renderAll();
    drawBarChart();
    drawDonutChart();
    drawTrendChart();
}

function shakeModal() {
    const modal = document.querySelector('.modal');
    modal.style.animation = 'none';
    void modal.offsetWidth;
    modal.style.animation = 'shake 0.4s ease';
}

// Add shake keyframes dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = '@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }';
document.head.appendChild(shakeStyle);

// ── 12. Edit Entry ────────────────────────
function startEdit(id) {
    const e = entries.find(x => x.id === id);
    if (!e) return;

    editingId = id;
    form.title.textContent     = 'Edit Entry';
    form.submitBtn.textContent = 'Save Changes';
    form.label.value  = e.label;
    form.amount.value = e.amount;
    form.type.value   = e.type;
    form.date.value   = e.date;
    updateCatDropdown(e.type);

    // Set category after dropdown update
    setTimeout(() => { form.cat.value = e.category; }, 0);

    document.getElementById('modal-overlay').classList.add('open');
}

// ── 13. Delete Entry ──────────────────────
function deleteEntry(id) {
    entries = entries.filter(e => e.id !== id);
    save();
    renderAll();
    drawBarChart();
    drawDonutChart();
    drawTrendChart();
}

// ── 14. Filters ───────────────────────────
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderAll();
        });
    });
}

// ── 15. Render All ────────────────────────
function renderAll() {
    renderCards();
    renderRecentList();
    renderEntriesList();
    renderMonthlySummary();
}

// ── 16. Summary Cards ─────────────────────
function renderCards() {
    const inc     = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const exp     = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const balance = inc - exp;

    document.getElementById('tot-inc').textContent = formatPKR(inc);
    document.getElementById('tot-exp').textContent = formatPKR(exp);

    const balEl   = document.getElementById('tot-bal');
    balEl.textContent = (balance >= 0 ? '' : '-') + formatPKR(balance);
    balEl.style.color = balance >= 0 ? 'var(--inc)' : 'var(--exp)';

    document.getElementById('entry-count').textContent  = entries.length;
    const ec2 = document.getElementById('entry-count-2');
    if (ec2) ec2.textContent = entries.length;
}

// ── 17. Entry Card HTML ───────────────────
function entryHTML(e) {
    const icon = catIcons[e.category] || '◈';
    const cls  = e.type === 'income' ? 'inc' : 'exp';
    const sign = e.type === 'income' ? '+' : '-';
    return `
        <div class="entry-item" data-id="${e.id}">
            <div class="entry-icon ${cls}">${icon}</div>
            <div class="entry-info">
                <div class="entry-label">${e.label}</div>
                <div class="entry-meta">
                    <span class="entry-cat-tag">${e.category}</span>
                    <span>${e.date}</span>
                </div>
            </div>
            <div class="entry-right">
                <div class="entry-amt ${cls}">${sign} ${formatPKR(e.amount)}</div>
                <div class="entry-actions">
                    <button class="icon-btn edit" onclick="startEdit('${e.id}')">Edit</button>
                    <button class="icon-btn del" onclick="deleteEntry('${e.id}')">Del</button>
                </div>
            </div>
        </div>`;
}

function emptyHTML(msg = 'No transactions yet.') {
    return `<div class="empty-state"><div class="empty-icon">◎</div><p>${msg}</p></div>`;
}

// ── 18. Recent List (Dashboard) ───────────
function renderRecentList() {
    const list = document.getElementById('recent-list');
    if (!list) return;

    const recent = entries.slice(0, 5);
    list.innerHTML = recent.length
        ? recent.map(entryHTML).join('')
        : emptyHTML('Add your first entry to get started!');
}

// ── 19. Full Entries List ─────────────────
function renderEntriesList() {
    const list = document.getElementById('entries-list');
    if (!list) return;

    let filtered = entries;

    // Apply type filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(e => e.type === currentFilter);
    }

    // Apply search
    if (searchQuery) {
        filtered = filtered.filter(e =>
            e.label.toLowerCase().includes(searchQuery) ||
            e.category.toLowerCase().includes(searchQuery) ||
            e.date.includes(searchQuery)
        );
    }

    list.innerHTML = filtered.length
        ? filtered.map(entryHTML).join('')
        : emptyHTML(searchQuery ? `No results for "${searchQuery}"` : 'No entries found.');
}

// ── 20. Monthly Summary ───────────────────
function renderMonthlySummary() {
    const container = document.getElementById('monthly-summary');
    if (!container) return;

    // Group by month
    const months = {};
    entries.forEach(e => {
        const key = getMonthKey(e.date);
        if (!months[key]) months[key] = { inc: 0, exp: 0 };
        if (e.type === 'income')  months[key].inc += e.amount;
        if (e.type === 'expense') months[key].exp += e.amount;
    });

    const sorted = Object.keys(months).sort((a, b) => b.localeCompare(a));

    if (!sorted.length) {
        container.innerHTML = emptyHTML('No data yet.');
        return;
    }

    container.innerHTML = sorted.map(key => {
        const { inc, exp } = months[key];
        const net = inc - exp;
        const netCls = net >= 0 ? 'pos' : 'neg';
        const netSign = net >= 0 ? '+' : '-';
        return `
            <div class="month-row">
                <span class="month-name">${monthLabel(key)}</span>
                <div class="month-amounts">
                    <span class="month-inc">+${formatPKR(inc)}</span>
                    <span class="month-exp">-${formatPKR(exp)}</span>
                    <span class="month-net ${netCls}">${netSign}${formatPKR(net)}</span>
                </div>
            </div>`;
    }).join('');
}

// ── 21. Chart Helpers ─────────────────────
function getThemeColor(opacity = 1) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return isDark
        ? `rgba(255,255,255,${opacity})`
        : `rgba(30,30,30,${opacity})`;
}

function getGridColor() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

// Lightweight chart drawing functions (no external library needed)
// ── 22. Bar Chart (Monthly Overview) ──────
let selectedMonth = null;

function populateMonthSelect() {
    const sel = document.getElementById('chart-month-select');
    if (!sel) return;

    // Get last 6 months
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        months.push({ key, label: monthLabel(key) });
    }

    sel.innerHTML = months.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
    selectedMonth = months[0].key;
}

function setupChartMonthChange() {
    const sel = document.getElementById('chart-month-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
        selectedMonth = sel.value;
        drawBarChart();
    });
}

function drawBarChart() {
    const canvas = document.getElementById('barChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Determine days in selected month
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // Aggregate income and expense per week bucket (4 buckets)
    const weeks = [
        { label: 'W1', inc: 0, exp: 0, days: [1, 7] },
        { label: 'W2', inc: 0, exp: 0, days: [8, 14] },
        { label: 'W3', inc: 0, exp: 0, days: [15, 21] },
        { label: 'W4', inc: 0, exp: 0, days: [22, daysInMonth] }
    ];

    entries.forEach(e => {
        if (!e.date.startsWith(selectedMonth)) return;
        const day = parseInt(e.date.split('-')[2]);
        const week = weeks.find(w => day >= w.days[0] && day <= w.days[1]);
        if (!week) return;
        if (e.type === 'income')  week.inc += e.amount;
        if (e.type === 'expense') week.exp += e.amount;
    });

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth - 32;
    const H = 180;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...weeks.flatMap(w => [w.inc, w.exp]), 1);
    const padL = 48, padR = 16, padT = 16, padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const groupW = chartW / 4;
    const barW   = groupW * 0.28;

    // Grid lines
    ctx.strokeStyle = getGridColor();
    ctx.lineWidth   = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
        const yy = padT + chartH * (1 - frac);
        ctx.beginPath();
        ctx.moveTo(padL, yy);
        ctx.lineTo(padL + chartW, yy);
        ctx.stroke();

        // Y labels
        const val = maxVal * frac;
        ctx.fillStyle = getThemeColor(0.3);
        ctx.font = '9px DM Sans, sans-serif';
        ctx.textAlign = 'right';
        const label = val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0);
        ctx.fillText(label, padL - 4, yy + 3);
    });

    // Bars
    weeks.forEach((w, i) => {
        const cx = padL + groupW * i + groupW / 2;

        // Income bar
        const incH = (w.inc / maxVal) * chartH;
        const incY = padT + chartH - incH;
        ctx.fillStyle = '#10d9a0';
        roundRect(ctx, cx - barW - 2, incY, barW, incH, 4);
        ctx.fill();

        // Expense bar
        const expH = (w.exp / maxVal) * chartH;
        const expY = padT + chartH - expH;
        ctx.fillStyle = '#ff5c7d';
        roundRect(ctx, cx + 2, expY, barW, expH, 4);
        ctx.fill();

        // Week label
        ctx.fillStyle = getThemeColor(0.45);
        ctx.font = '10px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(w.label, cx, H - padB + 16);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    if (h < r) r = h;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── 23. Donut Chart (By Category) ────────
const PALETTE = ['#10d9a0','#ff5c7d','#7c6fff','#f59e0b','#38bdf8','#fb923c','#a78bfa','#4ade80','#f472b6','#e879f9'];

function drawDonutChart() {
    const canvas = document.getElementById('donutChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Tally by category (expenses only for spending breakdown)
    const catTotals = {};
    entries.filter(e => e.type === 'expense').forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    const labels = Object.keys(catTotals);
    const values = labels.map(l => catTotals[l]);
    const total  = values.reduce((s, v) => s + v, 0) || 1;

    const dpr = window.devicePixelRatio || 1;
    const SIZE = Math.min(canvas.parentElement.clientWidth - 32, 180);
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width  = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, SIZE, SIZE);

    if (!labels.length) {
        ctx.fillStyle = getThemeColor(0.1);
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = getThemeColor(0.3);
        ctx.font = '11px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No expenses', SIZE / 2, SIZE / 2 + 4);
        return;
    }

    const cx = SIZE / 2, cy = SIZE / 2;
    const outerR = SIZE / 2 - 10;
    const innerR = outerR * 0.58;
    let startAngle = -Math.PI / 2;

    values.forEach((val, i) => {
        const slice = (val / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fillStyle = PALETTE[i % PALETTE.length];
        ctx.fill();
        startAngle += slice;
    });

    // Hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    ctx.fillStyle = isDark ? '#13161e' : '#ffffff';
    ctx.fill();

    // Legend
    const legend = document.getElementById('donut-legend');
    if (legend) {
        legend.innerHTML = labels.map((l, i) => `
            <span style="display:inline-flex;align-items:center;gap:4px;margin:2px 6px;font-size:11px">
                <span style="width:8px;height:8px;border-radius:50%;background:${PALETTE[i % PALETTE.length]};display:inline-block"></span>
                ${l}
            </span>`).join('');
    }
}

// ── 24. Trend Chart (Analytics) ───────────
function drawTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Aggregate last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        months.push({ key, label: monthLabel(key), inc: 0, exp: 0 });
    }

    entries.forEach(e => {
        const month = months.find(m => e.date.startsWith(m.key));
        if (!month) return;
        if (e.type === 'income')  month.inc += e.amount;
        if (e.type === 'expense') month.exp += e.amount;
    });

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth - 32;
    const H = 200;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...months.flatMap(m => [m.inc, m.exp]), 1);
    const padL = 48, padR = 16, padT = 16, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const stepX  = chartW / (months.length - 1 || 1);

    // Grid
    ctx.strokeStyle = getGridColor();
    ctx.lineWidth   = 1;
    [0, 0.5, 1].forEach(frac => {
        const yy = padT + chartH * (1 - frac);
        ctx.beginPath();
        ctx.moveTo(padL, yy);
        ctx.lineTo(padL + chartW, yy);
        ctx.stroke();
        const val = maxVal * frac;
        ctx.fillStyle = getThemeColor(0.3);
        ctx.font = '9px DM Sans, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0), padL - 4, yy + 3);
    });

    // Draw line
    function drawLine(dataKey, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2.5;
        ctx.lineJoin    = 'round';
        months.forEach((m, i) => {
            const x = padL + i * stepX;
            const y = padT + chartH - (m[dataKey] / maxVal) * chartH;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        months.forEach((m, i) => {
            const x = padL + i * stepX;
            const y = padT + chartH - (m[dataKey] / maxVal) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });
    }

    drawLine('inc', '#10d9a0');
    drawLine('exp', '#ff5c7d');

    // X labels
    months.forEach((m, i) => {
        const x = padL + i * stepX;
        ctx.fillStyle = getThemeColor(0.4);
        ctx.font = '9px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, x, H - padB + 16);
    });
}

// ── 25. Hamburger (Mobile) ────────────────
function setupHamburger() {
    const ham  = document.getElementById('hamburger');
    const side = document.querySelector('.sidebar');
    if (!ham || !side) return;
    ham.addEventListener('click', () => side.classList.toggle('open'));
}

// ── 26. Redraw on resize ──────────────────
window.addEventListener('resize', () => {
    drawBarChart();
    drawDonutChart();
    drawTrendChart();
});

// ── 27. Initial chart draw (deferred) ─────
setTimeout(() => {
    drawBarChart();
    drawDonutChart();
}, 100);
