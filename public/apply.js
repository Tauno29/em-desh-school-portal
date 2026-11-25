import { api, errorMessage, gradeLabel } from './api.js?v=20261125a';

const form = document.getElementById('apply-form');
const panel = document.getElementById('apply-panel');
const done = document.getElementById('apply-done');
const doneTitle = document.getElementById('apply-done-title');
const doneText = document.getElementById('apply-done-text');
const again = document.getElementById('apply-again');
const submit = document.getElementById('apply-submit');
const status = document.getElementById('apply-status');

const firstName = document.getElementById('apply-first');
const lastName = document.getElementById('apply-last');
const grade = document.getElementById('apply-grade');
const father = document.getElementById('apply-father');
const fatherPhone = document.getElementById('apply-father-phone');
const fatherOccupation = document.getElementById('apply-father-occupation');
const mother = document.getElementById('apply-mother');
const motherPhone = document.getElementById('apply-mother-phone');
const motherOccupation = document.getElementById('apply-mother-occupation');
const guardian = document.getElementById('apply-guardian');
const email = document.getElementById('apply-email');
const phone = document.getElementById('apply-phone');
const message = document.getElementById('apply-message');
const consent = document.getElementById('apply-consent');
const website = document.getElementById('apply-website');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setStatus(text, tone = 'error') {
  status.textContent = text;
  status.classList.toggle('is-error', tone === 'error');
  status.classList.toggle('is-success', tone === 'success');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  if (!form.reportValidity()) return;

  const guardianEmail = email.value.trim();
  const guardianPhone = phone.value.trim();
  if (!guardianEmail && !guardianPhone) {
    setStatus('Add a guardian email or phone number so the school office can reply.');
    email.focus();
    return;
  }
  if (guardianEmail && !EMAIL.test(guardianEmail)) {
    setStatus('Enter a valid email address.');
    email.focus();
    return;
  }

  const childName = `${firstName.value.trim()} ${lastName.value.trim()}`;
  submit.disabled = true;
  setStatus('Sending your application…', 'success');
  try {
    await api('/api/apply', {
      method: 'POST',
      body: {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        grade: grade.value,
        fatherName: father.value.trim(),
        fatherPhone: fatherPhone.value.trim(),
        fatherOccupation: fatherOccupation.value.trim(),
        motherName: mother.value.trim(),
        motherPhone: motherPhone.value.trim(),
        motherOccupation: motherOccupation.value.trim(),
        guardianName: guardian.value.trim(),
        guardianEmail,
        guardianPhone,
        message: message.value.trim(),
        consent: consent.checked,
        website: website.value,
      },
    });
    doneText.textContent = `Thank you. The school office will review the application for ${childName} (${gradeLabel(grade.value)}) and contact you about a placement assessment.`;
    form.reset();
    setStatus('');
    panel.hidden = true;
    done.hidden = false;
    doneTitle.focus();
  } catch (error) {
    setStatus(errorMessage(error, 'Your application could not be sent. Please try again.'));
  } finally {
    submit.disabled = false;
  }
});

again.addEventListener('click', () => {
  form.reset();
  setStatus('');
  done.hidden = true;
  panel.hidden = false;
  firstName.focus();
});
