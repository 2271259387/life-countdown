(() => {
  const STORAGE_KEY = 'life-countdown-config-v3';
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
  const MS_DAY = 24 * 60 * 60 * 1000;

  const DEFAULT_CONFIG = {
    birthDate: '2001-09-19',
    maxAge: 70
  };

  let timer = null;
  let renderedYear = null;
  let config = loadConfig();

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function formatShort(date) {
    return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function formatMonthTempLabel(month) {
    const labels = ['严寒', '仍冷', '回暖', '春和', '暖热', '初夏', '炎夏', '盛夏', '初秋', '秋凉', '深秋', '寒冬'];
    return labels[month];
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function addYearsClamped(date, years) {
    const target = new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
    if (target.getMonth() !== date.getMonth()) {
      return new Date(date.getFullYear() + years, date.getMonth() + 1, 0);
    }
    return target;
  }

  function anniversaryForYear(birth, year) {
    const d = new Date(year, birth.getMonth(), birth.getDate());
    if (d.getMonth() !== birth.getMonth()) {
      return new Date(year, birth.getMonth() + 1, 0);
    }
    return d;
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      const next = {
        birthDate: parsed.birthDate || DEFAULT_CONFIG.birthDate,
        maxAge: Number(parsed.maxAge || DEFAULT_CONFIG.maxAge)
      };
      const error = validateConfig(next);
      return error ? { ...DEFAULT_CONFIG } : next;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(next) {
    config = { birthDate: next.birthDate, maxAge: Number(next.maxAge) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function validateConfig(value) {
    const birth = parseLocalDate(value.birthDate);
    const age = Number(value.maxAge);
    const today = startOfDay(new Date());
    if (!birth) return '请输入有效的出生日期。';
    if (birth > today) return '出生日期不能晚于今天。';
    if (!Number.isInteger(age) || age < 1 || age > 120) return '预期年龄请输入 1–120 的整数。';
    return '';
  }

  function getLifeState(now = new Date()) {
    const birth = parseLocalDate(config.birthDate);
    const today = startOfDay(now);
    const thisYearsBirthday = anniversaryForYear(birth, today.getFullYear());
    const birthdayPassed = today >= thisYearsBirthday;
    const currentAge = today.getFullYear() - birth.getFullYear() - (birthdayPassed ? 0 : 1);
    const lastBirthday = birthdayPassed ? thisYearsBirthday : anniversaryForYear(birth, today.getFullYear() - 1);
    const nextBirthday = anniversaryForYear(birth, lastBirthday.getFullYear() + 1);
    const ageSpan = nextBirthday - lastBirthday;
    const ageElapsed = clamp((now - lastBirthday) / ageSpan, 0, 1);
    const ageRemaining = 1 - ageElapsed;
    const daysToBirthday = Math.max(0, Math.ceil((nextBirthday - now) / MS_DAY));

    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const nextYear = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    const yearRemaining = clamp((nextYear - now) / (nextYear - yearStart), 0, 1);
    const daysToYearEnd = Math.max(0, Math.ceil((nextYear - now) / MS_DAY));

    const dayStart = startOfDay(now);
    const dayEnd = new Date(dayStart.getTime() + MS_DAY);
    const dayElapsed = clamp((now - dayStart) / MS_DAY, 0, 1);
    const dayRemaining = clamp((dayEnd - now) / MS_DAY, 0, 1);

    return {
      birth,
      today,
      now,
      currentAge,
      lastBirthday,
      nextBirthday,
      ageElapsed,
      ageRemaining,
      daysToBirthday,
      year,
      yearStart,
      nextYear,
      yearRemaining,
      daysToYearEnd,
      dayElapsed,
      dayRemaining
    };
  }

  function setRing(id, ratio, ariaText) {
    const ring = $(id);
    const percent = clamp(ratio * 100, 0, 100);
    ring.style.setProperty('--p', percent.toFixed(2));
    if (ariaText) ring.setAttribute('aria-label', ariaText);
  }

  function renderLifeScale(state) {
    const maxAge = Number(config.maxAge);
    const scale = $('life-scale');
    const labels = $('scale-labels');
    scale.innerHTML = '';
    labels.innerHTML = '';

    const currentForScale = clamp(state.currentAge, 0, maxAge);
    const pastPercent = (currentForScale / maxAge) * 100;
    const progressPercent = clamp(
      ((currentForScale + state.ageElapsed) / maxAge) * 100,
      0,
      100
    );
    scale.style.setProperty('--life-past', `${pastPercent}%`);
    scale.style.setProperty('--life-progress', `${progressPercent}%`);
    scale.setAttribute('role', 'img');
    scale.setAttribute(
      'aria-label',
      `已走过 ${state.currentAge} 岁，当前年龄进度 ${(state.ageElapsed * 100).toFixed(1)}%，预期寿命 ${maxAge} 岁`
    );

    const steps = new Set([0, maxAge]);
    const labelStep = maxAge <= 40 ? 5 : 10;
    for (let age = labelStep; age < maxAge; age += labelStep) {
      steps.add(age);
    }
    [...steps].sort((a, b) => a - b).forEach(age => {
      const label = document.createElement('span');
      label.className = 'scale-label';
      label.textContent = age;
      label.style.left = `${(age / maxAge) * 100}%`;
      labels.appendChild(label);
    });

    const badge = $('current-age-badge');
    badge.style.setProperty('--current-position', `${progressPercent}%`);
    badge.textContent = `${state.currentAge} 岁`;
  }

  function monthRemainingRatio(year, month, now) {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
    if (now < start) return 1;
    if (now >= end) return 0;
    return clamp((end - now) / (end - start), 0, 1);
  }

  function buildDayCell(year, month, day) {
    const cell = document.createElement('div');
    cell.className = 'day-cell day-date';
    cell.dataset.date = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const em = document.createElement('em');
    em.textContent = String(day);
    cell.appendChild(em);
    return cell;
  }

  function renderYearCalendar(year) {
    const grid = $('year-grid');
    grid.innerHTML = '';

    for (let month = 0; month < 12; month++) {
      const card = document.createElement('article');
      card.className = `month-card month-${month + 1}`;
      card.dataset.month = String(month);
      card.innerHTML = `
        <div class="month-head">
          <div class="month-name"><strong>${month + 1} 月</strong><span>${formatMonthTempLabel(month)}</span></div><span class="month-current-label" aria-label="当前月份">本月</span>
          <div class="month-ring" data-month-ring="${month}" role="img"></div>
        </div>
        <div class="days-grid" data-days-grid="${month}"></div>`;

      grid.appendChild(card);
      const daysGrid = card.querySelector('[data-days-grid]');

      WEEKDAYS.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'day-cell weekday';
        cell.textContent = day;
        daysGrid.appendChild(cell);
      });

      const firstDayMondayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
      const count = daysInMonth(year, month);
      for (let i = 0; i < 42; i++) {
        const dayNumber = i - firstDayMondayIndex + 1;
        if (dayNumber < 1 || dayNumber > count) {
          const empty = document.createElement('div');
          empty.className = 'day-cell day-empty';
          daysGrid.appendChild(empty);
        } else {
          daysGrid.appendChild(buildDayCell(year, month, dayNumber));
        }
      }
    }

    renderedYear = year;
  }

  function updateCalendarState(state) {
    const yearChanged = renderedYear !== state.year;
    if (yearChanged) renderYearCalendar(state.year);
    const todayTime = state.today.getTime();

    document.querySelectorAll('.month-card').forEach(card => {
      const month = Number(card.dataset.month);
      const monthStart = new Date(state.year, month, 1);
      const monthEnd = new Date(state.year, month + 1, 1);
      const monthRing = card.querySelector('.month-ring');
      const ratio = monthRemainingRatio(state.year, month, state.now);
      card.classList.toggle('past-month', state.now >= monthEnd);
      card.classList.toggle('current-month', state.now >= monthStart && state.now < monthEnd);
      monthRing.style.setProperty('--p', (ratio * 100).toFixed(2));
      monthRing.setAttribute('aria-label', `${month + 1} 月剩余 ${(ratio * 100).toFixed(1)}%`);
      monthRing.title = `${month + 1} 月剩余 ${(ratio * 100).toFixed(1)}%`;
    });

    const grid = $('year-grid');
    const currentCard = grid.querySelector('.month-card.current-month');
    if (currentCard && (yearChanged || grid.dataset.centeredMonth !== currentCard.dataset.month)) {
      grid.scrollLeft = Math.max(
        0,
        currentCard.offsetLeft - (grid.clientWidth - currentCard.offsetWidth) / 2
      );
      grid.dataset.centeredMonth = currentCard.dataset.month;
    }

    document.querySelectorAll('.day-date').forEach(cell => {
      const date = parseLocalDate(cell.dataset.date);
      const time = date.getTime();
      cell.classList.remove('day-past', 'day-today', 'day-future', 'weekend');

      if (time < todayTime) {
        cell.classList.add('day-past');
        cell.style.setProperty('--day-progress', '100');
      } else if (time === todayTime) {
        cell.classList.add('day-today');
        cell.style.setProperty('--day-progress', (state.dayElapsed * 100).toFixed(2));
      } else {
        cell.classList.add('day-future');
        cell.style.setProperty('--day-progress', '0');
        if (date.getDay() === 0 || date.getDay() === 6) {
          cell.classList.add('weekend');
        }
      }

      cell.title = `${formatDate(date)}${time === todayTime ? ` · 今日已过 ${(state.dayElapsed * 100).toFixed(1)}%` : ''}`;
    });
  }

  function updateUI() {
    const state = getLifeState();
    const agePct = state.ageRemaining * 100;
    const yearPct = state.yearRemaining * 100;

    setRing('age-ring', state.ageRemaining, `当前这一岁剩余 ${agePct.toFixed(1)}%，约 ${state.daysToBirthday} 天`);
    setRing('year-ring', state.yearRemaining, `本年度剩余 ${yearPct.toFixed(1)}%`);

    $('birthday-days').textContent = state.daysToBirthday;
    $('next-age-label').textContent = `距 ${state.currentAge + 1} 岁`;
    $('age-percent').textContent = `剩余 ${agePct.toFixed(1)}%`;
    $('year-percent').textContent = yearPct.toFixed(1);
    $('year-days-left').textContent = `${state.daysToYearEnd} 天`;

    renderLifeScale(state);
    updateCalendarState(state);
  }

  function openSettings() {
    $('birth-input').value = config.birthDate;
    $('age-input').value = config.maxAge;
    $('form-error').textContent = '';
    $('settings-modal').classList.add('open');
    $('settings-modal').setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => $('birth-input').focus());
  }

  function closeSettings() {
    $('settings-modal').classList.remove('open');
    $('settings-modal').setAttribute('aria-hidden', 'true');
  }

  function setupEvents() {
    $('settings-button').addEventListener('click', openSettings);
    $('close-settings').addEventListener('click', closeSettings);
    $('settings-modal').addEventListener('click', (event) => {
      if (event.target === $('settings-modal')) closeSettings();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSettings();
    });

    $('reset-settings').addEventListener('click', () => {
      $('birth-input').value = DEFAULT_CONFIG.birthDate;
      $('age-input').value = DEFAULT_CONFIG.maxAge;
      $('form-error').textContent = '';
    });

    $('settings-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const next = {
        birthDate: $('birth-input').value,
        maxAge: Number($('age-input').value)
      };
      const error = validateConfig(next);
      $('form-error').textContent = error;
      if (error) return;
      saveConfig(next);
      renderedYear = null;
      updateUI();
      closeSettings();
    });
  }

  function start() {
    setupEvents();
    renderYearCalendar(new Date().getFullYear());
    updateUI();
    timer = window.setInterval(updateUI, 60000);
    window.addEventListener('focus', updateUI);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateUI();
    });
  }

  start();
})();
