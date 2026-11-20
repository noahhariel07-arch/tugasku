// =========================================================
// BASIS DATA LOKAL (localStorage) & REGISTRASI SERVICE WORKER
// =========================================================
const DB_TASKS_KEY = 'tugasku_direct_notif_db_v1';
const DB_THEME_KEY = 'tugasku_theme_direct_v1';

let tasks = JSON.parse(localStorage.getItem(DB_TASKS_KEY)) || [];
let swRegistration = null;

// Registrasi Service Worker agar Web Notification bekerja optimal di HP Android/iOS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      swRegistration = reg;
    })
    .catch(() => {
      // Tetap berjalan normal menggunakan fallback Notification standar
    });
}

function generateSampleTasks() {
  const now = Date.now();
  const hour = 3600 * 1000;
  return [
    {
      id: 1001,
      course: 'Pemrograman Web',
      type: 'Proyek UTS/UAS',
      name: 'Membuat Aplikasi Web Berbasis DOM & LocalStorage',
      deadline: new Date(now + 12 * hour).toISOString().slice(0, 16),
      priority: 'Tinggi',
      progress: 80,
      link: 'https://s.id/UTSWEB2027',
      notifiedUrgent: false,
      notifiedOverdue: false
    },
    {
      id: 1002,
      course: 'Basis Data Lanjut',
      type: 'Praktikum',
      name: 'Normalisasi Tabel & Query Join Multi-Tabel',
      deadline: new Date(now + 48 * hour).toISOString().slice(0, 16),
      priority: 'Sedang',
      progress: 35,
      link: 'E-Learning ITG',
      notifiedUrgent: false,
      notifiedOverdue: false
    },
    {
      id: 1003,
      course: 'Jaringan Komputer',
      type: 'Kelompok',
      name: 'Simulasi Subnetting & Routing Statis Packet Tracer',
      deadline: new Date(now + 96 * hour).toISOString().slice(0, 16),
      priority: 'Rendah',
      progress: 0,
      link: 'Google Classroom',
      notifiedUrgent: false,
      notifiedOverdue: false
    },
    {
      id: 1004,
      course: 'Rekayasa Perangkat Lunak',
      type: 'Individu',
      name: 'Penyusunan Dokumen SRS & Use Case Diagram',
      deadline: new Date(now - 3 * hour).toISOString().slice(0, 16),
      priority: 'Tinggi',
      progress: 100,
      link: 'Sudah dikumpulkan',
      notifiedUrgent: true,
      notifiedOverdue: true
    }
  ];
}

if (tasks.length === 0 && !localStorage.getItem('tugasku_direct_init_v1')) {
  tasks = generateSampleTasks();
  localStorage.setItem('tugasku_direct_init_v1', 'true');
  saveDatabase();
}

function saveDatabase() {
  localStorage.setItem(DB_TASKS_KEY, JSON.stringify(tasks));
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

// =========================================================
// MODUL NOTIFIKASI LANGSUNG HP (WEB NOTIFICATION + GETAR + AUDIO)
// =========================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Menghasilkan bunyi alarm bip sintetik via Web Audio API
function playAlarmSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const frequencies = [880, 1100, 880];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.22);
      osc.stop(ctx.currentTime + idx * 0.22 + 0.16);
    });
  } catch (e) {
    // Abaikan jika browser memblokir autoplay audio sebelum ada klik
  }
}

// Memperbarui indikator status izin notifikasi HP di layar
const notifStatusBadge = document.getElementById('notif-status-badge');
function updateNotifStatusBadge() {
  if (!('Notification' in window)) {
    notifStatusBadge.textContent = 'Browser Tidak Mendukung Notif';
    notifStatusBadge.className = 'badge badge-Tinggi';
    return;
  }

  if (Notification.permission === 'granted') {
    notifStatusBadge.textContent = 'Notifikasi HP: AKTIF';
    notifStatusBadge.className = 'badge badge-Selesai';
  } else if (Notification.permission === 'denied') {
    notifStatusBadge.textContent = 'Notifikasi HP: Diblokir Browser';
    notifStatusBadge.className = 'badge badge-Tinggi';
  } else {
    notifStatusBadge.textContent = 'Notifikasi HP: Belum Diizinkan';
    notifStatusBadge.className = 'badge badge-Sedang';
  }
}
updateNotifStatusBadge();

// Fungsi utama memunculkan notifikasi native langsung ke bar atas layar HP
async function kirimNotifLangsungHP(judul, pesan) {
  // 1. Getarkan HP (khusus perangkat mobile yang mendukung)
  if ('vibrate' in navigator) {
    navigator.vibrate([350, 150, 350, 150, 500]);
  }

  // 2. Bunyikan alarm suara
  playAlarmSound();

  // 3. Tampilkan notifikasi sistem HP
  if (!('Notification' in window)) {
    showToast(`${judul}: ${pesan}`, 'info');
    return false;
  }

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    updateNotifStatusBadge();
    if (perm !== 'granted') {
      showToast('Izin notifikasi HP belum aktif. Klik "1. Aktifkan Izin Notif HP".', 'error');
      return false;
    }
  }

  const options = {
    body: pesan,
    vibrate: [350, 150, 350],
    tag: 'tugasku-reminder-' + Date.now(),
    renotify: true
  };

  try {
    // Prioritaskan Service Worker (wajib untuk Chrome Android)
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(judul, options);
    } else if ('serviceWorker' in navigator) {
      const readyReg = await navigator.serviceWorker.ready;
      await readyReg.showNotification(judul, options);
    } else {
      new Notification(judul, options);
    }
    return true;
  } catch (err) {
    try {
      new Notification(judul, options);
      return true;
    } catch (e) {
      showToast('Pastikan web dibuka via HTTPS atau Localhost agar notif HP muncul.', 'error');
      return false;
    }
  }
}

// Tombol 1: Meminta izin notifikasi HP
document.getElementById('btn-enable-notif').addEventListener('click', async () => {
  if (!('Notification' in window)) {
    showToast('Browser ini tidak mendukung Web Notification API.', 'error');
    return;
  }

  const permission = await Notification.requestPermission();
  updateNotifStatusBadge();

  if (permission === 'granted') {
    await kirimNotifLangsungHP(
      'Notifikasi HP Berhasil Diaktifkan!',
      'Pengingat deadline TugasKu akan langsung muncul di layar HP Anda.'
    );
    showToast('Izin notifikasi HP aktif!', 'success');
  } else {
    showToast('Izin ditolak. Buka pengaturan situs di browser HP dan izinkan Notifikasi.', 'error');
  }
});

// Tombol 2: Tes notifikasi langsung sekarang
document.getElementById('btn-test-notif-now').addEventListener('click', async () => {
  const ok = await kirimNotifLangsungHP(
    'Tes Pengingat TugasKu',
    'Ini adalah contoh notifikasi pengingat yang langsung masuk ke layar HP Anda!'
  );
  if (ok) {
    showToast('Notifikasi berhasil dimunculkan di layar!', 'success');
  }
});

// Tombol 3: Tes notifikasi dengan jeda 5 detik (bisa coba kunci/minimize browser HP)
document.getElementById('btn-test-notif-delay').addEventListener('click', () => {
  showToast('Notifikasi akan muncul dalam 5 detik. Coba minimize browser HP Anda...', 'info');
  setTimeout(() => {
    kirimNotifLangsungHP(
      'Pengingat Terjadwal (5 Detik)',
      'Notifikasi tetap masuk ke bilah status HP Anda!'
    );
  }, 5000);
});

// Kirim Notifikasi Tugas Tertentu ke Layar HP
async function notifTugasSekarang(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  const formattedDate = new Date(task.deadline).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const ok = await kirimNotifLangsungHP(
    `Pengingat: ${task.course}`,
    `${task.name} | Deadline: ${formattedDate} (Progres: ${task.progress}%)`
  );
  if (ok) {
    showToast(`Notifikasi "${task.name}" dikirim ke layar HP!`, 'success');
  }
}

// =========================================================
// FITUR ALARM BAWAAN HP VIA EXPORT KALENDER (.ICS)
// =========================================================
function simpanKeKalenderHP(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  const startStr = task.deadline.replace(/[-:]/g, '') + '00';
  const endDate = new Date(new Date(task.deadline).getTime() + 30 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const endStr =
    `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T` +
    `${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TugasKu Reminder//ITG Pemrograman Web//ID',
    'BEGIN:VEVENT',
    `UID:tugasku-${task.id}@itg.ac.id`,
    `DTSTAMP:${startStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:[DEADLINE] ${task.course} - ${task.name}`,
    `DESCRIPTION:Jenis: ${task.type} | Prioritas: ${task.priority} | Progres: ${task.progress}% | Link: ${task.link || '-'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Pengingat H-1 Hari: ${task.name}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Pengingat 1 Jam Lagi: ${task.name}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Alarm_${task.course.replace(/\s+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('File kalender (.ics) diunduh! Buka file tersebut di HP untuk memasang alarm otomatis.', 'success');
}

// =========================================================
// NAVIGASI HALAMAN & DARK MODE
// =========================================================
const navButtons = document.querySelectorAll('.nav-btn');
const pageSections = document.querySelectorAll('.page-section');

function switchPage(targetId) {
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === targetId);
  });
  pageSections.forEach((sec) => {
    sec.classList.toggle('active', sec.id === targetId);
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    switchPage(btn.getAttribute('data-target'));
  });
});

const btnTheme = document.getElementById('btn-theme');
if (localStorage.getItem(DB_THEME_KEY) === 'dark') {
  document.body.classList.add('dark-theme');
  btnTheme.textContent = 'Mode Terang';
}

btnTheme.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  btnTheme.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
  localStorage.setItem(DB_THEME_KEY, isDark ? 'dark' : 'light');
});

// =========================================================
// PERHITUNGAN STATUS & WAKTU MUNDUR (COUNTDOWN)
// =========================================================
function getTaskStatus(progress) {
  if (Number(progress) >= 100) return 'Selesai';
  if (Number(progress) > 0) return 'Sedang Dikerjakan';
  return 'Belum Dikerjakan';
}

function getCountdownInfo(deadlineStr, isCompleted) {
  if (isCompleted) {
    return { text: 'SELESAI TEPAT WAKTU', isUrgent: false, isDone: true };
  }

  const now = Date.now();
  const target = new Date(deadlineStr).getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { text: 'DEADLINE TERLEWAT (OVERDUE)!', isUrgent: true, isDone: false };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const isUrgent = diff < 24 * 60 * 60 * 1000;
  return {
    text: `Sisa: ${days}h ${hours}j ${minutes}m ${seconds}d`,
    isUrgent,
    isDone: false
  };
}

// =========================================================
// RENDER STATISTIK & BANNER PERINGATAN
// =========================================================
function renderStatsAndBanner() {
  const activeTasks = tasks.filter((t) => Number(t.progress) < 100);
  const completedTasks = tasks.filter((t) => Number(t.progress) >= 100);
  const urgentTasks = activeTasks.filter((t) => {
    const diff = new Date(t.deadline).getTime() - Date.now();
    return diff < 24 * 60 * 60 * 1000;
  });

  const avgProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + Number(t.progress), 0) / tasks.length)
      : 0;

  document.getElementById('stat-aktif').textContent = activeTasks.length;
  document.getElementById('stat-mendesak').textContent = urgentTasks.length;
  document.getElementById('stat-progres').textContent = avgProgress + '%';
  document.getElementById('stat-selesai').textContent = completedTasks.length;

  const banner = document.getElementById('urgent-banner');
  const urgentMsg = document.getElementById('urgent-message');

  if (urgentTasks.length > 0) {
    banner.classList.remove('hidden');
    const names = urgentTasks.map((t) => `${t.course} (${t.name})`).join(', ');
    urgentMsg.textContent = `Terdapat ${urgentTasks.length} tugas mendesak (< 24 jam / terlewat): ${names}`;
  } else {
    banner.classList.add('hidden');
  }
}

document.getElementById('btn-notif-urgent-now').addEventListener('click', () => {
  const urgentTasks = tasks.filter((t) => {
    return Number(t.progress) < 100 && new Date(t.deadline).getTime() - Date.now() < 24 * 60 * 60 * 1000;
  });

  if (urgentTasks.length === 0) return;

  const ringkasan = urgentTasks.map((t) => `${t.course} (${t.name})`).join(', ');
  kirimNotifLangsungHP(
    `Peringatan ${urgentTasks.length} Tugas Mendesak!`,
    `Segera selesaikan: ${ringkasan}`
  );
});

// =========================================================
// RENDER KARTU TUGAS & UPDATE COUNTDOWN REAL-TIME
// =========================================================
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterPrioritas = document.getElementById('filter-prioritas');
const sortBy = document.getElementById('sort-by');

[searchInput, filterStatus, filterPrioritas, sortBy].forEach((el) => {
  el.addEventListener('input', renderTaskGrid);
  el.addEventListener('change', renderTaskGrid);
});

function renderTaskGrid() {
  const grid = document.getElementById('task-grid');
  const keyword = searchInput.value.toLowerCase();
  const statusVal = filterStatus.value;
  const prioVal = filterPrioritas.value;
  const sortVal = sortBy.value;

  const prioWeight = { Tinggi: 3, Sedang: 2, Rendah: 1 };

  let filtered = tasks.filter((t) => {
    const matchText =
      t.name.toLowerCase().includes(keyword) ||
      t.course.toLowerCase().includes(keyword);
    const currentStatus = getTaskStatus(t.progress);
    const matchStatus = statusVal === 'Semua' || currentStatus === statusVal;
    const matchPrio = prioVal === 'Semua' || t.priority === prioVal;
    return matchText && matchStatus && matchPrio;
  });

  filtered.sort((a, b) => {
    if (sortVal === 'deadline-asc') return new Date(a.deadline) - new Date(b.deadline);
    if (sortVal === 'priority-desc') return prioWeight[b.priority] - prioWeight[a.priority];
    if (sortVal === 'progress-asc') return a.progress - b.progress;
    return 0;
  });

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="card"><p>Tidak ada jadwal tugas yang sesuai filter.</p></div>';
    return;
  }

  filtered.forEach((task) => {
    const isDone = Number(task.progress) >= 100;
    const statusText = getTaskStatus(task.progress);
    const countdown = getCountdownInfo(task.deadline, isDone);
    const formattedDate = new Date(task.deadline).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const card = document.createElement('div');
    card.className = `task-card prio-${task.priority} ${isDone ? 'is-done' : ''}`;

    card.innerHTML = `
      <div>
        <div class="task-header">
          <span class="course-tag">${escapeHTML(task.course)} • ${escapeHTML(task.type)}</span>
          <span class="badge badge-${isDone ? 'Selesai' : task.priority}">
            ${isDone ? 'Selesai' : task.priority}
          </span>
        </div>
        <h4 class="task-title" style="margin-top: 0.4rem;">${escapeHTML(task.name)}</h4>
        <p class="task-meta" style="margin-top: 0.25rem;">Deadline: <strong>${formattedDate}</strong></p>
        ${task.link ? `<p class="task-meta">Info/Link: ${escapeHTML(task.link)}</p>` : ''}
      </div>

      <div class="countdown-box ${countdown.isUrgent ? 'urgent' : ''} ${countdown.isDone ? 'done' : ''}"
           data-deadline="${task.deadline}"
           data-done="${isDone}">
        ${countdown.text}
      </div>

      <div class="progress-wrapper">
        <div class="progress-label">
          <span>Status: ${statusText}</span>
          <span id="prog-val-${task.id}">${task.progress}%</span>
        </div>
        <div class="progress-track">
          <div id="prog-bar-${task.id}" class="progress-fill ${isDone ? 'complete' : ''}" style="width: ${task.progress}%"></div>
        </div>
        <input type="range" min="0" max="100" step="5" value="${task.progress}"
               oninput="previewProgress(${task.id}, this.value)"
               onchange="updateTaskProgress(${task.id}, this.value)">
      </div>

      <div class="btn-group">
        ${
          !isDone
            ? `<button class="btn-success btn-sm" onclick="updateTaskProgress(${task.id}, 100)">Selesai</button>`
            : `<button class="btn-outline btn-sm" onclick="updateTaskProgress(${task.id}, 50)">Buka Lagi</button>`
        }
        <button class="btn-info btn-sm" onclick="notifTugasSekarang(${task.id})">Notif HP</button>
        <button class="btn-primary btn-sm" onclick="simpanKeKalenderHP(${task.id})">Alarm Kalender</button>
        <button class="btn-warning btn-sm" onclick="editTask(${task.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="deleteTask(${task.id})">Hapus</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function previewProgress(id, value) {
  const label = document.getElementById(`prog-val-${id}`);
  const bar = document.getElementById(`prog-bar-${id}`);
  if (label) label.textContent = value + '%';
  if (bar) bar.style.width = value + '%';
}

function updateTaskProgress(id, value) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  task.progress = Number(value);
  saveDatabase();
  refreshAll();

  if (task.progress === 100) {
    showToast(`Selamat! Tugas "${task.name}" telah selesai.`, 'success');
  }
}

// =========================================================
// PEMANTAUAN TIMER REAL-TIME & PEMICU OTOMATIS NOTIF HP
// =========================================================
setInterval(() => {
  // 1. Update tampilan hitung mundur setiap detik di layar
  const countdownBoxes = document.querySelectorAll('.countdown-box');
  countdownBoxes.forEach((box) => {
    const deadline = box.getAttribute('data-deadline');
    const isDone = box.getAttribute('data-done') === 'true';
    const info = getCountdownInfo(deadline, isDone);
    box.textContent = info.text;
    box.classList.toggle('urgent', info.isUrgent);
  });

  // 2. Pemicu otomatis notifikasi HP saat sisa waktu < 24 jam atau tepat habis
  let dbChanged = false;
  tasks.forEach((task) => {
    if (Number(task.progress) >= 100) return;

    const diff = new Date(task.deadline).getTime() - Date.now();

    if (diff > 0 && diff <= 24 * 60 * 60 * 1000 && !task.notifiedUrgent) {
      task.notifiedUrgent = true;
      dbChanged = true;

      const jamSisa = Math.ceil(diff / (1000 * 60 * 60));
      kirimNotifLangsungHP(
        `Deadline < 24 Jam: ${task.course}`,
        `Tugas "${task.name}" tersisa ±${jamSisa} jam lagi!`
      );
    }

    if (diff <= 0 && !task.notifiedOverdue) {
      task.notifiedOverdue = true;
      dbChanged = true;

      kirimNotifLangsungHP(
        `Batas Waktu Habis: ${task.course}`,
        `Deadline tugas "${task.name}" telah tiba!`
      );
    }
  });

  if (dbChanged) {
    saveDatabase();
    renderStatsAndBanner();
  }
}, 1000);

// =========================================================
// CRUD FORM TAMBAH & EDIT TUGAS
// =========================================================
const taskForm = document.getElementById('task-form');
const taskIdInput = document.getElementById('task-id');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = taskIdInput.value;
  const sendNow = document.getElementById('send-notif-now').checked;
  const existingTask = id ? tasks.find((t) => t.id === Number(id)) : null;

  const taskData = {
    id: id ? Number(id) : Date.now(),
    course: document.getElementById('task-course').value.trim(),
    type: document.getElementById('task-type').value,
    name: document.getElementById('task-name').value.trim(),
    deadline: document.getElementById('task-deadline').value,
    priority: document.getElementById('task-priority').value,
    progress: Math.min(100, Math.max(0, Number(document.getElementById('task-progress').value))),
    link: document.getElementById('task-link').value.trim(),
    notifiedUrgent: existingTask ? existingTask.notifiedUrgent : false,
    notifiedOverdue: existingTask ? existingTask.notifiedOverdue : false
  };

  if (id) {
    const idx = tasks.findIndex((t) => t.id === Number(id));
    if (idx !== -1) tasks[idx] = taskData;
    showToast('Jadwal tugas berhasil diperbarui!', 'success');
  } else {
    tasks.push(taskData);
    showToast('Pengingat tugas baru berhasil disimpan!', 'success');
  }

  saveDatabase();
  refreshAll();

  if (sendNow) {
    await notifTugasSekarang(taskData.id);
  }

  resetForm();
  switchPage('page-dashboard');
});

function editTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  taskIdInput.value = task.id;
  document.getElementById('task-course').value = task.course;
  document.getElementById('task-type').value = task.type;
  document.getElementById('task-name').value = task.name;
  document.getElementById('task-deadline').value = task.deadline;
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-progress').value = task.progress;
  document.getElementById('task-link').value = task.link || '';

  document.getElementById('form-title').textContent = 'Edit Pengingat Tugas';
  document.getElementById('btn-submit-task').textContent = 'Update Tugas';
  btnCancelEdit.classList.remove('hidden');
  switchPage('page-form');
}

function resetForm() {
  taskForm.reset();
  taskIdInput.value = '';
  document.getElementById('send-notif-now').checked = true;
  document.getElementById('form-title').textContent = 'Tambah Jadwal & Pengingat Tugas Baru';
  document.getElementById('btn-submit-task').textContent = 'Simpan Pengingat Tugas';
  btnCancelEdit.classList.add('hidden');
}

btnCancelEdit.addEventListener('click', () => {
  resetForm();
  switchPage('page-dashboard');
});

function deleteTask(id) {
  if (!confirm('Hapus pengingat tugas ini dari database?')) return;
  tasks = tasks.filter((t) => t.id !== id);
  saveDatabase();
  refreshAll();
  showToast('Tugas berhasil dihapus.', 'info');
}

// =========================================================
// HALAMAN REKAPITULASI & EXPORT / IMPORT DATABASE
// =========================================================
function renderRekapTable() {
  const tbody = document.getElementById('tbody-rekap');
  tbody.innerHTML = '';

  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Database tugas masih kosong.</td></tr>';
    return;
  }

  tasks.forEach((t) => {
    const tr = document.createElement('tr');
    const formattedDate = new Date(t.deadline).toLocaleString('id-ID');
    tr.innerHTML = `
      <td><strong>${escapeHTML(t.course)}</strong></td>
      <td>${escapeHTML(t.name)}</td>
      <td>${escapeHTML(t.type)}</td>
      <td>${formattedDate}</td>
      <td>${t.priority}</td>
      <td>${t.progress}%</td>
      <td><strong>${getTaskStatus(t.progress)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('btn-load-sample').addEventListener('click', () => {
  if (!confirm('Muat data contoh? Data tugas saat ini akan diganti.')) return;
  tasks = generateSampleTasks();
  saveDatabase();
  refreshAll();
  showToast('Data tugas contoh berhasil dimuat!', 'success');
});

document.getElementById('btn-export-db').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_tugasku_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Database berhasil diexport ke JSON!', 'success');
});

document.getElementById('input-import-db').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (Array.isArray(parsed)) {
        tasks = parsed;
        saveDatabase();
        refreshAll();
        showToast('Database berhasil diimport!', 'success');
      } else {
        showToast('Format file JSON tidak valid!', 'error');
      }
    } catch (err) {
      showToast('Gagal membaca file JSON!', 'error');
    }
  };
  reader.readAsText(file);
});

document.getElementById('btn-clear-db').addEventListener('click', () => {
  if (!confirm('Hapus permanen semua data tugas?')) return;
  tasks = [];
  saveDatabase();
  refreshAll();
  showToast('Seluruh data berhasil dihapus.', 'info');
});

function refreshAll() {
  renderStatsAndBanner();
  renderTaskGrid();
  renderRekapTable();
}

refreshAll();