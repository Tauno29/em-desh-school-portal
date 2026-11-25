import {
  api, clearAuthToken, errorMessage, gradeLabel, formatDate, initials, setAuthToken,
} from './api.js?v=20261125a';

const TOKEN_KEY = 'omps_portal_token';

function restoreToken() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) setAuthToken(token);
  } catch {
    // Storage can be unavailable in hardened browsers; cookie sessions still apply.
  }
}

function persistToken(token) {
  setAuthToken(token);
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* cookie session only */ }
}

function forgetToken() {
  clearAuthToken();
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* nothing to clear */ }
}

restoreToken();

const loginPanel = document.getElementById('login-panel');
const accountPanel = document.getElementById('account-panel');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const loginSubmit = document.getElementById('login-submit');
const pinForm = document.getElementById('pin-form');
const pinStatus = document.getElementById('pin-status');
const signout = document.getElementById('signout');

const recordsStatus = document.getElementById('records-status');
const behaviorList = document.getElementById('portal-behavior');
const behaviorEmpty = document.getElementById('portal-behavior-empty');
const testsWrap = document.getElementById('portal-tests-wrap');
const testsBody = document.getElementById('portal-tests');
const testsEmpty = document.getElementById('portal-tests-empty');
const reportsList = document.getElementById('portal-reports');
const reportsEmpty = document.getElementById('portal-reports-empty');

function setStatus(node, text, tone = 'error') {
  node.textContent = text;
  node.classList.toggle('is-error', tone === 'error');
  node.classList.toggle('is-success', tone === 'success');
}

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function focusHeading(id) {
  document.getElementById(id)?.focus({ preventScroll: true });
}

function clearRecords() {
  behaviorList.replaceChildren();
  testsBody.replaceChildren();
  reportsList.replaceChildren();
  behaviorEmpty.hidden = true;
  testsEmpty.hidden = true;
  testsWrap.hidden = true;
  reportsEmpty.hidden = true;
  setStatus(recordsStatus, '');
}

function renderRecords(data) {
  const behavior = Array.isArray(data.behavior) ? data.behavior : [];
  const tests = Array.isArray(data.tests) ? data.tests : [];
  const reports = Array.isArray(data.reportCards) ? data.reportCards : [];

  behaviorList.replaceChildren(...behavior.map((row) => {
    const item = document.createElement('li');
    const note = document.createElement('p');
    note.className = 'portal-record-note';
    note.textContent = row.note;
    const meta = document.createElement('p');
    meta.className = 'portal-record-meta';
    meta.textContent = formatDate(row.recordedOn);
    item.append(note, meta);
    return item;
  }));
  behaviorEmpty.hidden = behavior.length > 0;

  testsBody.replaceChildren(...tests.map((row) => {
    const tr = document.createElement('tr');
    const values = [row.subject, `${row.score}%`, row.term || '—', formatDate(row.recordedOn)];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      tr.append(cell);
    }
    return tr;
  }));
  testsWrap.hidden = tests.length === 0;
  testsEmpty.hidden = tests.length > 0;

  reportsList.replaceChildren(...reports.map((row) => {
    const item = document.createElement('li');
    const body = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'portal-record-note';
    title.textContent = row.fileName || 'Report card';
    const meta = document.createElement('p');
    meta.className = 'portal-record-meta';
    meta.textContent = [row.term, formatDate(row.createdAt)].filter(Boolean).join(' · ');
    body.append(title, meta);
    item.append(body);
    if (row.status === 'ready' && row.url) {
      const open = document.createElement('a');
      open.className = 'btn btn-ghost btn-sm';
      open.href = row.url;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Open';
      item.append(open);
    }
    return item;
  }));
  reportsEmpty.hidden = reports.length > 0;
}

async function loadRecords() {
  try {
    const data = await api('/api/portal/records');
    renderRecords(data);
    setStatus(recordsStatus, '');
  } catch (error) {
    if (error.status === 401) {
      setStatus(recordsStatus, '');
      return;
    }
    setStatus(recordsStatus, errorMessage(error, 'Records could not be loaded.'));
  }
}

function showAccount(learner, { focus = false } = {}) {
  text('account-avatar', initials(learner.firstName, learner.lastName));
  text('account-name', `${learner.firstName} ${learner.lastName}`);
  text('account-id', learner.studentId);
  text('account-grade', gradeLabel(learner.grade));
  text('account-class', learner.className || '—');
  text('account-guardian', learner.guardianName || '—');
  text('account-phone', learner.guardianPhone || '—');
  text('account-enrolled', formatDate(learner.enrolledAt) || '—');
  const badge = document.getElementById('account-status');
  badge.textContent = learner.status === 'active' ? 'Active' : 'Inactive';
  badge.className = `badge ${learner.status === 'active' ? 'badge-active' : 'badge-inactive'}`;
  loginPanel.hidden = true;
  accountPanel.hidden = false;
  document.querySelector('.auth-grid').classList.add('is-signed-in');
  clearRecords();
  loadRecords();
  if (focus) focusHeading('account-title');
}

function showLogin({ focus = false } = {}) {
  forgetToken();
  accountPanel.hidden = true;
  loginPanel.hidden = false;
  document.querySelector('.auth-grid').classList.remove('is-signed-in');
  clearRecords();
  loginForm.reset();
  pinForm.reset();
  setStatus(loginStatus, '');
  setStatus(pinStatus, '');
  if (focus) focusHeading('login-title');
}

const studentIdInput = document.getElementById('student-id');
studentIdInput.addEventListener('input', () => {
  const upper = studentIdInput.value.toUpperCase();
  if (upper === studentIdInput.value) return;
  const caret = studentIdInput.selectionStart;
  studentIdInput.value = upper;
  studentIdInput.setSelectionRange(caret, caret);
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const studentId = document.getElementById('student-id').value.trim().toUpperCase();
  const pin = document.getElementById('pin').value.trim();
  loginSubmit.disabled = true;
  setStatus(loginStatus, 'Signing in…', 'success');
  try {
    const data = await api('/api/portal/login', { method: 'POST', body: { studentId, pin } });
    if (data?.token) persistToken(data.token);
    showAccount(data.learner, { focus: true });
  } catch (error) {
    setStatus(loginStatus, errorMessage(error));
  } finally {
    loginSubmit.disabled = false;
  }
});

pinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!pinForm.reportValidity()) return;
  const currentPin = document.getElementById('current-pin').value.trim();
  const newPin = document.getElementById('new-pin').value.trim();
  const confirmPin = document.getElementById('confirm-pin').value.trim();
  if (newPin !== confirmPin) {
    setStatus(pinStatus, 'The new PINs do not match.');
    return;
  }
  const button = pinForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(pinStatus, 'Updating…', 'success');
  try {
    await api('/api/portal/change-pin', { method: 'POST', body: { currentPin, newPin } });
    pinForm.reset();
    setStatus(pinStatus, 'PIN updated. Use your new PIN next time you sign in.', 'success');
  } catch (error) {
    if (error.code === 'login_required') {
      showLogin();
      setStatus(loginStatus, 'Your session has ended. Please sign in again.');
      return;
    }
    setStatus(pinStatus, error.code === 'invalid_credentials'
      ? 'That current PIN is not correct.'
      : errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

signout.addEventListener('click', async () => {
  signout.disabled = true;
  try {
    await api('/api/portal/logout', { method: 'POST' });
  } catch {
    // Signing out locally still removes the visible record.
  } finally {
    signout.disabled = false;
    showLogin({ focus: true });
  }
});

(async () => {
  try {
    const data = await api('/api/portal/me');
    showAccount(data.learner);
  } catch (error) {
    if (error.status === 401) forgetToken();
    else setStatus(loginStatus, errorMessage(error));
  }
})();
