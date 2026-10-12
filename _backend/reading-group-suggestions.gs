/**
 * Paper suggestions for the reading-group page (/reading-group/).
 *
 * This is a Google Apps Script that belongs to a Google Sheet. Deployed as a
 * web app, it lets the page list the suggestions (GET) and add one (POST).
 * Each suggestion is one row of the sheet "Suggestions": delete a row to
 * remove that suggestion from the page.
 *
 * Setup steps are in README.md ("Paper suggestions"). The copy that runs is
 * the one pasted into the sheet's script editor; after changing this file,
 * paste it there again and deploy a new version.
 *
 * @OnlyCurrentDoc
 */

var SHEET_NAME = 'Suggestions';
// The headings of the columns the script uses. It finds each column by its
// heading, so in the sheet you can reorder columns, add your own (for notes),
// or delete ones not listed here. Do not rename these headings in the sheet.
var COLUMNS = {
  submitted: 'Submitted',
  title: 'Paper title',
  url: 'Paper URL',
  authors: 'Authors',
  year: 'Year',
  contributor: 'Suggested by',
};
var MAX_LENGTH = { title: 300, url: 500, authors: 300, contributor: 100 };
var MAX_SUGGESTIONS = 500; // no new rows are accepted beyond this many
var MAX_PER_HOUR = 30; // new suggestions per hour, counted over all visitors

// -----------------------------------------------------------------------------
// Web app entry points
// -----------------------------------------------------------------------------

function doGet() {
  try {
    return json({ ok: true, suggestions: publicList(readSuggestions(getSheet(false))) });
  } catch (error) {
    return json({ ok: false, message: 'The suggestions could not be read.' });
  }
}

function doPost(e) {
  var input;
  try {
    input = JSON.parse(e.postData.contents);
  } catch (error) {
    input = null;
  }
  if (!input || typeof input !== 'object') {
    return json({ ok: false, message: 'The suggestion could not be read.' });
  }
  // "website" is a field people cannot see; only automated senders fill it in.
  if (oneLine(input.website)) {
    return json({ ok: false, message: 'This suggestion was not accepted.' });
  }

  var result = validateSuggestion(input);
  if (!result.valid) return json({ ok: false, errors: result.errors });
  var suggestion = result.values;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // one submission at a time, so two cannot add the same paper
  } catch (error) {
    return json({ ok: false, message: 'The server is busy. Please try again in a moment.' });
  }
  try {
    var sheet = getSheet(true);
    var existing = readSuggestions(sheet);

    var inProgram = findDuplicate(suggestion, programPapers(input.program));
    if (inProgram) {
      return json({ ok: false, errors: { url: 'This paper is already in the reading program: “' + inProgram.title + '”.' } });
    }
    var suggested = findDuplicate(suggestion, existing);
    if (suggested) {
      return json({ ok: false, errors: { url: 'This paper has already been suggested: “' + suggested.title + '”.' } });
    }
    if (existing.length >= MAX_SUGGESTIONS || !countTowardsHourlyLimit()) {
      return json({ ok: false, message: 'Too many suggestions were submitted recently. Please try again later.' });
    }

    var cells = {
      submitted: new Date(),
      title: asText(suggestion.title),
      url: suggestion.url,
      authors: asText(suggestion.authors),
      year: asText(suggestion.year),
      contributor: asText(suggestion.contributor),
    };
    var headingRow = headings(sheet);
    var position = columnPositions(headingRow);
    var row = headingRow.map(function () { return ''; });
    Object.keys(cells).forEach(function (field) {
      if (position[field] >= 0) row[position[field]] = cells[field];
    });
    sheet.appendRow(row);
    return json({ ok: true, suggestions: publicList(readSuggestions(sheet)) });
  } catch (error) {
    return json({ ok: false, message: 'The suggestion could not be saved. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}

// -----------------------------------------------------------------------------
// The sheet
// -----------------------------------------------------------------------------

function getSheet(create) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet && create) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet && create && sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(COLUMNS).map(function (field) { return COLUMNS[field]; }));
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function headings(sheet) {
  return sheet.getDataRange().getDisplayValues()[0];
}

// Where each column is, by heading. Fails if a column the page needs is gone.
function columnPositions(headingRow) {
  var position = {};
  Object.keys(COLUMNS).forEach(function (field) {
    position[field] = headingRow.indexOf(COLUMNS[field]);
  });
  ['title', 'url', 'contributor'].forEach(function (field) {
    if (position[field] < 0) throw new Error('The sheet has no column "' + COLUMNS[field] + '".');
  });
  return position;
}

// The valid rows of the sheet, oldest first. A row edited by hand into
// something invalid is skipped rather than shown.
function readSuggestions(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getDataRange().getDisplayValues();
  var position = columnPositions(rows[0]);
  var suggestions = [];
  rows.slice(1).forEach(function (row) {
    var result = validateSuggestion({
      title: row[position.title],
      url: row[position.url],
      authors: row[position.authors],
      year: row[position.year],
      contributor: row[position.contributor],
    });
    if (result.valid) suggestions.push(result.values);
  });
  return suggestions;
}

function publicList(suggestions) {
  return suggestions.map(function (s) {
    return { title: s.title, url: s.url, authors: s.authors, year: s.year, contributor: s.contributor };
  });
}

// A cell whose text starts with = + - or @ would be run as a formula; a
// leading apostrophe makes the sheet store it as plain text instead.
function asText(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function countTowardsHourlyLimit() {
  var cache = CacheService.getScriptCache();
  var key = 'suggestions-' + Math.floor(Date.now() / 3600000);
  var count = Number(cache.get(key)) || 0;
  if (count >= MAX_PER_HOUR) return false;
  cache.put(key, String(count + 1), 3700);
  return true;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------------
// Validation and duplicate detection
// -----------------------------------------------------------------------------

function oneLine(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

// Splits an http(s) link to a real host name into its parts; null for
// anything else (other schemes, embedded passwords, local addresses).
function parsePaperUrl(raw) {
  var text = oneLine(raw);
  if (!text || /[\s"'<>\\^`{|}]/.test(text)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = 'https://' + text; // "arxiv.org/abs/..." typed without https://
  var match = /^(https?):\/\/([^\/?#@]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i.exec(text);
  if (!match) return null;
  var host = match[2].toLowerCase();
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
  var path = match[3] || '/';
  var params = [];
  (match[4] || '').slice(1).split('&').forEach(function (pair) {
    if (pair) params.push([pair.split('=')[0], pair.split('=').slice(1).join('=')]);
  });
  return {
    href: match[1].toLowerCase() + '://' + host + path + (match[4] || '') + (match[5] || ''),
    host: host.replace(/^www\./, ''),
    path: path.replace(/\/+$/, ''),
    params: params,
  };
}

// Two links with the same key point to the same paper. arXiv versions and
// PDF links, DOI links, OpenReview and PMLR pages each collapse to one key.
function paperKey(link) {
  var match;

  if (/(^|\.)arxiv\.org$/.test(link.host) || link.host === 'alphaxiv.org') {
    match = /^\/(?:abs|pdf|html|format|ps)\/(.+?)(?:v\d+)?(?:\.pdf)?$/i.exec(link.path);
    if (match) return 'arxiv:' + match[1].toLowerCase();
  }
  if (link.host === 'doi.org' || link.host === 'dx.doi.org') {
    var doi = link.path.slice(1).toLowerCase();
    match = /^10\.48550\/arxiv\.(.+?)(?:v\d+)?$/.exec(doi);
    return match ? 'arxiv:' + match[1] : 'doi:' + doi;
  }
  if (link.host === 'openreview.net') {
    var id = link.params.filter(function (pair) { return pair[0] === 'id'; })[0];
    if (id && id[1]) return 'openreview:' + id[1];
  }
  if (link.host === 'proceedings.mlr.press') {
    match = /^\/(v\d+)\/([^\/.]+)/i.exec(link.path);
    if (match) return 'pmlr:' + (match[1] + '/' + match[2]).toLowerCase();
  }

  // Any other site: ignore the scheme, "www.", a trailing slash, the fragment
  // and tracking parameters.
  var query = link.params
    .filter(function (pair) { return !/^utm_/i.test(pair[0]); })
    .map(function (pair) { return pair[0] + '=' + pair[1]; })
    .sort()
    .join('&');
  return link.host + link.path.toLowerCase() + (query ? '?' + query : '');
}

function titleKey(title) {
  return oneLine(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Checks one suggestion. Returns the cleaned values and a message per invalid
// field. Used for new submissions and again for every row read from the sheet.
function validateSuggestion(input) {
  var values = {
    title: oneLine(input.title),
    url: oneLine(input.url),
    authors: oneLine(input.authors),
    year: oneLine(input.year),
    contributor: oneLine(input.contributor),
  };
  var errors = {};

  if (!values.title) errors.title = 'Enter the paper title.';

  var link = parsePaperUrl(values.url);
  if (!values.url) {
    errors.url = 'Enter a link to the paper.';
  } else if (!link) {
    errors.url = 'Enter a valid web link, for example https://arxiv.org/abs/1706.03762.';
  } else {
    values.url = link.href;
    values.key = paperKey(link);
  }

  var year = Number(values.year);
  var latestYear = new Date().getFullYear() + 1;
  if (values.year && !(/^\d{4}$/.test(values.year) && year >= 1900 && year <= latestYear)) {
    errors.year = 'Enter a four-digit year, or leave this empty.';
  }

  if (!values.contributor) errors.contributor = 'Enter your name.';

  Object.keys(MAX_LENGTH).forEach(function (field) {
    if (!errors[field] && values[field].length > MAX_LENGTH[field]) {
      errors[field] = 'Shorten this to at most ' + MAX_LENGTH[field] + ' characters.';
    }
  });

  return { values: values, errors: errors, valid: Object.keys(errors).length === 0 };
}

// Finds the paper in `papers` that `candidate` duplicates, by link or title.
function findDuplicate(candidate, papers) {
  var candidateTitle = titleKey(candidate.title);
  for (var i = 0; i < papers.length; i++) {
    if (papers[i].key === candidate.key || (candidateTitle && titleKey(papers[i].title) === candidateTitle)) {
      return papers[i];
    }
  }
  return null;
}

// The reading program as sent by the page, reduced to titles and link keys.
function programPapers(list) {
  var papers = [];
  (Array.isArray(list) ? list : []).slice(0, 100).forEach(function (paper) {
    if (!paper) return;
    var link = parsePaperUrl(paper.url);
    papers.push({ title: oneLine(paper.title), key: link ? paperKey(link) : '' });
  });
  return papers;
}
