// Reading-group page: lists paper suggestions and submits new ones.
//
// Suggestions are stored in a Google Sheet. The page talks to the sheet's
// script (_backend/reading-group-suggestions.gs), whose address is set as
// suggestions.endpoint in _data/reading_group.yml. That script checks every
// suggestion and rejects duplicates; this file only sends, receives and shows.

(function () {
  'use strict';

  const root = document.getElementById('reading-group');
  const endpoint = root ? root.getAttribute('data-endpoint') : '';
  if (!endpoint) return;

  const listBox = document.getElementById('rg-suggestions');
  const refreshButton = document.getElementById('rg-refresh');
  const form = document.getElementById('rg-form');
  const submitButton = form.querySelector('button[type="submit"]');
  const formStatus = document.getElementById('rg-form-status');
  const fieldNames = ['title', 'url', 'authors', 'year', 'contributor'];

  // The reading program is printed by Jekyll; it is sent along with a new
  // suggestion so that the script can refuse papers already in the program.
  const program = Array.from(root.querySelectorAll('[data-paper-url]')).map(function (item) {
    return { title: item.getAttribute('data-paper-title'), url: item.getAttribute('data-paper-url') };
  });

  // All text from participants is inserted with textContent, never as HTML.
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showMessage(box, className, text) {
    box.replaceChildren(element('p', className, text));
  }

  function renderSuggestions(suggestions) {
    // Only complete entries with an ordinary web link are shown.
    const valid = (Array.isArray(suggestions) ? suggestions : []).filter(function (s) {
      return s && typeof s.title === 'string' && /^https?:\/\//i.test(s.url);
    });
    if (!valid.length) {
      showMessage(listBox, 'rg-status', 'No suggestions yet.');
      return;
    }
    const list = element('ul', 'rg-papers rg-suggested');
    valid.slice().reverse().forEach(function (suggestion) {
      const item = element('li', 'rg-paper');
      const title = element('div', 'rg-paper-title');
      const link = element('a', '', suggestion.title);
      link.href = suggestion.url;
      link.target = '_blank';
      link.rel = 'external nofollow noopener';
      title.appendChild(link);
      item.appendChild(title);
      const source = [suggestion.authors, suggestion.year].filter(Boolean).join(', ');
      if (source) item.appendChild(element('div', 'rg-paper-source', source));
      if (suggestion.contributor) {
        item.appendChild(element('div', 'rg-paper-contributor', 'Suggested by ' + suggestion.contributor));
      }
      list.appendChild(item);
    });
    listBox.replaceChildren(list);
  }

  // Sends a request to the sheet's script and returns its JSON answer. The
  // body is sent as plain text, which keeps the request a simple one that
  // browsers allow across sites without a preflight.
  function callEndpoint(body) {
    const options = body ? { method: 'POST', body: JSON.stringify(body) } : { cache: 'no-store' };
    return fetch(endpoint, options).then(function (response) {
      if (!response.ok) throw new Error('The server answered ' + response.status);
      return response.json();
    });
  }

  function loadSuggestions() {
    return callEndpoint()
      .then(function (answer) {
        if (!answer.ok) throw new Error(answer.message);
        renderSuggestions(answer.suggestions);
      })
      .catch(function () {
        showMessage(listBox, 'rg-status', 'The suggestions could not be loaded right now. Please try again later.');
      });
  }

  function showFieldErrors(errors) {
    let firstInvalid = null;
    fieldNames.forEach(function (name) {
      const input = form.elements[name];
      const message = (errors && errors[name]) || '';
      input.classList.toggle('is-invalid', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      document.getElementById('rg-' + name + '-error').textContent = message;
      if (message && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) firstInvalid.focus();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const suggestion = { program: program, website: form.elements.website.value };
    fieldNames.forEach(function (name) { suggestion[name] = form.elements[name].value; });

    showFieldErrors({});
    showMessage(formStatus, 'rg-status', 'Sending your suggestion…');
    submitButton.disabled = true;

    callEndpoint(suggestion)
      .then(function (answer) {
        if (answer.ok) {
          // The script answers with the list as saved, including the new entry.
          renderSuggestions(answer.suggestions);
          form.reset();
          showMessage(formStatus, 'rg-success', 'Thank you. Your suggestion is saved and listed under “Suggested papers”.');
        } else if (answer.errors) {
          showFieldErrors(answer.errors);
          const other = Object.keys(answer.errors)
            .filter(function (name) { return fieldNames.indexOf(name) === -1; })
            .map(function (name) { return answer.errors[name]; });
          showMessage(
            formStatus,
            'rg-error',
            'Your suggestion was not saved. ' + (other.length ? other.join(' ') : 'Please check the marked fields.')
          );
        } else {
          showMessage(formStatus, 'rg-error', answer.message || 'Your suggestion was not saved. Please try again.');
        }
      })
      .catch(function () {
        showMessage(formStatus, 'rg-error', 'Your suggestion could not be sent, so it was not saved. Please try again.');
      })
      .then(function () {
        submitButton.disabled = false;
      });
  });

  refreshButton.hidden = false;
  refreshButton.addEventListener('click', loadSuggestions);
  loadSuggestions();
})();
