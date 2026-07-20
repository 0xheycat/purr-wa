// ==UserScript==
// @name         Purr WA Export
// @namespace    https://github.com/0xheycat
// @version      1.0.0
// @description  Bulk-export your own WhatsApp Web chats to TXT / HTML / CSV. Reads WhatsApp's internal Store directly (no DOM scraping, no WA-JS). by 0xheycat
// @author       0xheycat
// @homepageURL  https://github.com/0xheycat
// @supportURL   https://github.com/0xheycat/purr-wa-export/issues
// @match        https://web.whatsapp.com/*
// @run-at       document-idle
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// ==/UserScript==

/*
 * Purr WA Export — by 0xheycat  (https://github.com/0xheycat)
 * Reads WhatsApp Web's internal Store (WAWebCollections + Cmd.openChatAt) directly.
 * No DOM scraping, no WA-JS/WPP (both broken on WA Web 2026). Only JSZip via @require.
 * Note: WhatsApp Web multi-device keeps a limited synced history window per chat;
 * older messages live on the phone. This tool exports everything available on the web.
 */
(function () {
  'use strict';
  if (window.__purrWaExport) return;
  window.__purrWaExport = true;

  var WM = '0xheycat';
  var APP = 'Purr WA Export';
  var REPO = 'https://github.com/0xheycat';
  var cfg = Object.assign({ afterOpen: 700, betweenChats: 350, scrollTries: 10, scrollWait: 650, scrollNoGrow: 3, mediaTimeout: 6000 }, (window.__PURR_CFG || {}));
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var req = function () { return window.require || self.require; };

  // ---------- CSP-safe element helper ----------
  function E(tag, cssText, props) {
    var el = document.createElement(tag);
    if (cssText) el.style.cssText = cssText;
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'text') el.textContent = props[k];
      else el.setAttribute(k, props[k]);
    });
    return el;
  }

  // ---------- store access ----------
  function coll() { try { return req()('WAWebCollections'); } catch (e) { return null; } }
  function cmd() { try { return req()('WAWebCmd').Cmd; } catch (e) { return null; } }
  function storeReady() { var c = coll(); return !!(c && c.Chat && typeof c.Chat.forEach === 'function'); }
  function isAuthed() { try { return !!document.querySelector('#pane-side') || storeReady(); } catch (e) { return false; } }

  var idOf = function (c) { try { return (c.id && (c.id._serialized || c.id.toString())) || ''; } catch (e) { return ''; } };
  var countMsgs = function (c) { var n = 0; try { c.msgs.forEach(function () { n++; }); } catch (e) {} return n; };
  var isRealChat = function (c) { var id = idOf(c); return (id.endsWith('@c.us') || id.endsWith('@g.us')) && id !== '0@c.us' && id.indexOf('status') < 0; };
  var readText = function (m) { try { return ((m.body || m.caption) || '').toString(); } catch (e) { return ''; } };
  var tOf = function (m) { return (m && (m.t || m.timestamp)) || 0; };
  var msgId = function (m) { try { return (m.id && (m.id._serialized || m.id.toString())) || (tOf(m) + '_' + Math.random()); } catch (e) { return String(Math.random()); } };
  var digits = function (s) { return (s == null ? '' : String(s)).replace(/[^\d]/g, ''); };
  var prettyNum = function (w) { var d = digits((w || '').toString().replace(/@.*/, '')); return d || (w || '').toString().replace(/@.*/, ''); };

  function chatTitle(c) { try { return c.formattedTitle || c.name || (c.contact && (c.contact.name || c.contact.pushname)) || prettyNum(idOf(c)); } catch (e) { return prettyNum(idOf(c)); } }
  function isGroup(c) { return idOf(c).endsWith('@g.us'); }

  // ---- number resolution (fixes "contact number unreadable") ----
  function widNumber(widStr) {
    if (!widStr) return '';
    var s = widStr.toString();
    if (/@c\.us$/.test(s)) { var d = digits(s.split('@')[0]); return d ? '+' + d : ''; }
    return ''; // @lid / @g.us have no exposable phone number
  }
  function contactNumber(ct) {
    try {
      var id = ct.id && (ct.id._serialized || ct.id.toString()) || '';
      var n = widNumber(id);
      if (n) return n;
      var user = (ct.id && ct.id.user) || ct.userid || ct.number || ct.phoneNumber || '';
      var d = digits(user);
      if (d.length >= 6) return '+' + d;
      // last resort: try phone via contact's known jid fields
      var alt = ct.phone || (ct.phoneNumber && ct.phoneNumber.toString());
      d = digits(alt);
      return d.length >= 6 ? '+' + d : '';
    } catch (e) { return ''; }
  }

  function nameFromWid(widStr) {
    if (!widStr) return '';
    try {
      var C = coll();
      var ct = C && C.Contact && C.Contact.get ? C.Contact.get(widStr) : null;
      if (ct) return ct.name || ct.pushname || ct.formattedName || ct.verifiedName || ct.displayName || widNumber(widStr) || prettyNum(widStr);
    } catch (e) {}
    return widNumber(widStr) || prettyNum(widStr);
  }
  function senderName(m) {
    try {
      if (m.id && m.id.fromMe) return 'You';
      var a = (m.author && (m.author._serialized || m.author.toString())) || (m.from && (m.from._serialized || m.from.toString())) || '';
      return nameFromWid(a) || 'Unknown';
    } catch (e) { return 'Unknown'; }
  }

  var MEDIA_TYPES = { image: '[Image]', video: '[Video]', audio: '[Audio]', ptt: '[Voice note]', document: '[Document]', sticker: '[Sticker]', location: '[Location]', vcard: '[Contact card]', multi_vcard: '[Contact cards]', product: '[Product]' };
  var SYS_LABEL = { call_log: '[Call]', gp2: '[Group event]', revoked: '[Deleted message]', poll_creation: '[Poll]' };
  var SKIP_TYPES = { e2e_notification: 1, notification_template: 1, notification: 1, protocol: 1, ciphertext: 1 };

  // ---------- fetch messages for one chat ----------
  function findScroller(main) {
    if (!main) return null;
    var cands = main.querySelectorAll('[data-id],[role="row"]');
    for (var i = 0; i < cands.length; i++) {
      var node = cands[i];
      while (node && node !== main.parentElement && node !== document.body) {
        try { var st = getComputedStyle(node); if ((node.scrollHeight - node.clientHeight > 40) && /(auto|scroll)/.test(st.overflowY)) return node; } catch (e) {}
        node = node.parentElement;
      }
    }
    return null;
  }
  function toArr(r) {
    var a = []; try {
      if (!r) return a;
      if (typeof r.forEach === 'function') { r.forEach(function (m) { a.push(m); }); return a; }
      if (r.length != null) { for (var i = 0; i < r.length; i++) a.push(r[i]); return a; }
    } catch (e) {}
    return a;
  }
  async function fetchChatMessages(chat) {
    var Cmd = cmd();
    try { if (Cmd) await Cmd.openChatAt({ chat: chat }); } catch (e) {}
    try { if (typeof chat.waitForChatLoading === 'function') await chat.waitForChatLoading(); } catch (e) {}
    await sleep(cfg.afterOpen);
    try {
      var main = document.querySelector('#main');
      var sc = findScroller(main);
      var last = countMsgs(chat), noGrow = 0;
      for (var s = 0; s < cfg.scrollTries && sc; s++) {
        try { sc.scrollTop = 0; sc.dispatchEvent(new WheelEvent('wheel', { deltaY: -1500, bubbles: true })); sc.dispatchEvent(new Event('scroll', { bubbles: true })); } catch (e) {}
        await sleep(cfg.scrollWait);
        if (!document.contains(sc)) sc = findScroller(main);
        var c = countMsgs(chat);
        if (c <= last) noGrow++; else noGrow = 0;
        last = c;
        if (noGrow >= cfg.scrollNoGrow) break;
      }
    } catch (e) {}
    var seen = {}, out = [];
    function add(list) { for (var i = 0; i < list.length; i++) { var m = list[i], k = msgId(m); if (!seen[k]) { seen[k] = 1; out.push(m); } } }
    try { var r = chat.getAllMsgs(); if (r && typeof r.then === 'function') r = await r; add(toArr(r)); } catch (e) {}
    try { var mm = []; chat.msgs.forEach(function (m) { mm.push(m); }); add(mm); } catch (e) {}
    out.sort(function (a, b) { return tOf(a) - tOf(b); });
    return out;
  }

  // best-effort image bytes (degrades to placeholder on any failure)
  async function tryMediaDataUrl(m) {
    try {
      if (!/^(image|sticker)$/.test(m.type || '')) return null;
      if (typeof m.downloadMedia !== 'function') return null;
      var p = m.downloadMedia();
      var res = await Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, cfg.mediaTimeout); })]);
      if (!res) return null;
      if (typeof res === 'string' && res.indexOf('data:') === 0) return res;
      var blob = res.blob || res._blob || (res instanceof Blob ? res : null);
      if (!blob) return null;
      return await new Promise(function (resolve) { var fr = new FileReader(); fr.onload = function () { resolve(fr.result); }; fr.onerror = function () { resolve(null); }; fr.readAsDataURL(blob); });
    } catch (e) { return null; }
  }

  // ---------- normalize ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(t) { var d = new Date(t * 1000); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function normalize(m, includeMedia) {
    var type = (m && m.type) || 'chat';
    var text = readText(m);
    var isMedia = MEDIA_TYPES.hasOwnProperty(type);
    if (!text) {
      if (isMedia) text = includeMedia ? MEDIA_TYPES[type] : '';
      else if (SYS_LABEL[type]) text = SYS_LABEL[type];
      else text = '';
    } else if (isMedia && !includeMedia) {
      // keep caption text even if media excluded
    }
    return { id: msgId(m), t: tOf(m), date: fmtDate(tOf(m)), fromMe: !!(m.id && m.id.fromMe), sender: senderName(m), type: type, text: text, isMedia: isMedia, _m: m };
  }

  // ---------- formatters ----------
  function toTxt(title, rows) {
    var out = [APP + ' — ' + title, 'Exported: ' + new Date().toLocaleString(), 'Messages: ' + rows.length, '========================================', ''];
    rows.forEach(function (r) { out.push('[' + r.date + '] ' + r.sender + ': ' + (r.text || '')); });
    out.push('', '---', 'Exported with ' + APP + ' — ' + REPO + ' (by ' + WM + ')');
    return out.join('\n');
  }
  function csvEsc(s) { s = (s == null ? '' : String(s)); return '"' + s.replace(/"/g, '""') + '"'; }
  function toCsv(title, rows) {
    var out = ['datetime,sender,fromMe,type,text'];
    rows.forEach(function (r) { out.push([csvEsc(r.date), csvEsc(r.sender), r.fromMe ? '1' : '0', csvEsc(r.type), csvEsc(r.text)].join(',')); });
    return out.join('\n');
  }
  function htmlEsc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toHtml(title, rows, dark, mediaMap) {
    var bg = dark ? '#0b141a' : '#efeae2', me = dark ? '#005c4b' : '#d9fdd3', other = dark ? '#202c33' : '#ffffff', tx = dark ? '#e9edef' : '#111', mut = dark ? '#8696a0' : '#667781';
    var css = 'body{margin:0;background:' + bg + ';color:' + tx + ';font-family:Segoe UI,Helvetica,Arial,sans-serif}'
      + '.wrap{max-width:820px;margin:0 auto;padding:20px 14px 60px}'
      + '.h{position:sticky;top:0;background:' + (dark ? '#111b21' : '#008069') + ';color:#fff;padding:12px 16px;border-radius:10px;margin-bottom:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center}'
      + '.h small{opacity:.8;font-weight:400}'
      + '.b{max-width:76%;padding:7px 10px;border-radius:9px;margin:5px 0;word-wrap:break-word;white-space:pre-wrap;box-shadow:0 1px 1px rgba(0,0,0,.15)}'
      + '.me{background:' + me + ';margin-left:auto}.ot{background:' + other + '}'
      + '.s{font-size:12px;font-weight:600;color:' + (dark ? '#53bdeb' : '#008069') + ';margin-bottom:2px}'
      + '.m{font-size:10px;color:' + mut + ';text-align:right;margin-top:2px}'
      + '.b img{max-width:100%;border-radius:6px;display:block;margin:2px 0}'
      + '.wm{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:11px;color:' + mut + ';padding:6px;background:' + (dark ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.6)') + '}';
    var parts = ['<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + htmlEsc(title) + ' — ' + APP + '</title><style>' + css + '</style></head><body><div class="wrap"><div class="h"><span>' + htmlEsc(title) + '</span><small>' + rows.length + ' messages</small></div>'];
    rows.forEach(function (r) {
      var media = mediaMap && mediaMap[r.id] ? '<img src="' + mediaMap[r.id] + '" alt="media">' : '';
      parts.push('<div class="b ' + (r.fromMe ? 'me' : 'ot') + '">' + (r.fromMe ? '' : '<div class="s">' + htmlEsc(r.sender) + '</div>') + media + htmlEsc(r.text || '') + '<div class="m">' + htmlEsc(r.date) + '</div></div>');
    });
    parts.push('</div><div class="wm">Exported with ' + APP + ' · by ' + WM + ' · ' + htmlEsc(REPO) + '</div></body></html>');
    return parts.join('');
  }

  // ---------- participants & contacts ----------
  function participantsOf(chat) {
    var out = [];
    try {
      var gm = chat.groupMetadata; var ps = gm && gm.participants;
      if (ps && ps.forEach) ps.forEach(function (p) { var w = (p.id && (p.id._serialized || p.id.toString())) || ''; out.push({ name: nameFromWid(w), number: widNumber(w) }); });
    } catch (e) {}
    return out;
  }
  function exportContacts() {
    var rows = ['name,number'], seen = {};
    try {
      var C = coll();
      C.Contact.forEach(function (ct) {
        try {
          var id = ct.id && (ct.id._serialized || ct.id.toString()) || '';
          if (!/@c\.us$/.test(id) && !/@lid$/.test(id)) return;
          var num = contactNumber(ct);
          var nm = ct.name || ct.pushname || ct.formattedName || ct.verifiedName || '';
          if (!nm && !num) return;
          var key = num || id;
          if (seen[key]) return; seen[key] = 1;
          rows.push(csvEsc(nm || '(no name)') + ',' + csvEsc(num || '(hidden)'));
        } catch (e) {}
      });
    } catch (e) {}
    return rows.join('\n');
  }

  // ---------- download ----------
  function dl(name, content, mime) {
    var blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function safeName(s) { return (s || 'chat').replace(/[^a-z0-9\-_ ]/gi, '_').slice(0, 60).trim() || 'chat'; }

  // ---------- chat list ----------
  function listChats() {
    var C = coll(); var arr = [];
    try { C.Chat.forEach(function (c) { if (isRealChat(c)) arr.push(c); }); } catch (e) {}
    arr.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
    return arr;
  }

  // ---------- UI ----------
  var ui = {}; var state = { chats: [], running: false, stop: false };
  function log(msg) { try { ui.log.textContent = ('[' + new Date().toLocaleTimeString() + '] ' + msg + '\n') + ui.log.textContent; } catch (e) {} }
  function setBar(p) { try { ui.bar.style.width = Math.max(0, Math.min(100, p)) + '%'; } catch (e) {} }
  function status(s) { try { ui.status.textContent = s; } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function checked(id) { var el = $(id); return !!(el && el.checked); }

  function chk(id, label, on) {
    var w = E('label', 'display:flex;align-items:center;gap:7px;margin:4px 0;cursor:pointer');
    var i = E('input', '', { type: 'checkbox', id: id }); if (on) i.checked = true;
    w.appendChild(i); w.appendChild(E('span', '', { text: label })); return w;
  }

  function buildUI() {
    var panel = E('div', 'position:fixed;top:14px;right:14px;width:340px;max-height:92vh;overflow:auto;z-index:2147483647;background:#111b21;color:#e9edef;border:1px solid #2a3942;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.5);font-family:Segoe UI,Arial,sans-serif;font-size:13px', { id: 'purr-panel' });
    var head = E('div', 'display:flex;align-items:center;gap:8px;padding:12px 14px;background:linear-gradient(135deg,#00a884,#005c4b);border-radius:14px 14px 0 0;font-weight:700');
    head.appendChild(E('span', 'font-size:16px', { text: '🐾' }));
    head.appendChild(E('span', 'flex:1', { text: APP }));
    var dot = E('span', 'width:9px;height:9px;border-radius:50%;background:#f2c94c', { id: 'purr-dot' });
    head.appendChild(dot);
    panel.appendChild(head);

    var body = E('div', 'padding:12px 14px');
    var gate = E('div', 'padding:18px 6px;text-align:center;color:#8696a0', { id: 'purr-gate' });
    gate.appendChild(E('div', 'font-size:26px;margin-bottom:6px', { text: '🔒' }));
    gate.appendChild(E('div', '', { text: 'Waiting for WhatsApp Web login…' }));
    body.appendChild(gate);

    var main = E('div', 'display:none', { id: 'purr-main' });

    main.appendChild(E('div', 'font-size:11px;letter-spacing:.5px;color:#8696a0;margin:2px 0 6px', { text: 'CHATS' }));
    var btnRow = E('div', 'display:flex;gap:6px;margin-bottom:8px');
    var bScan = E('button', 'flex:1;padding:7px;border:none;border-radius:8px;background:#2a3942;color:#e9edef;cursor:pointer', { id: 'purr-scan', text: 'Scan chats' });
    var bAll = E('button', 'flex:1;padding:7px;border:none;border-radius:8px;background:#182229;color:#8696a0;cursor:pointer', { id: 'purr-all', text: 'Select all' });
    var bNone = E('button', 'flex:1;padding:7px;border:none;border-radius:8px;background:#182229;color:#8696a0;cursor:pointer', { id: 'purr-none', text: 'Clear' });
    btnRow.appendChild(bScan); btnRow.appendChild(bAll); btnRow.appendChild(bNone); main.appendChild(btnRow);

    var chatBox = E('div', 'max-height:170px;overflow:auto;border:1px solid #2a3942;border-radius:8px;padding:6px;margin-bottom:6px', { id: 'purr-chats' });
    chatBox.appendChild(E('div', 'color:#8696a0;text-align:center;padding:10px', { text: 'Click “Scan chats” first' }));
    main.appendChild(chatBox);
    main.appendChild(E('div', 'color:#8696a0;font-size:12px;margin-bottom:8px', { id: 'purr-count', text: '' }));

    main.appendChild(E('div', 'font-size:11px;letter-spacing:.5px;color:#8696a0;margin:6px 0 4px', { text: 'FORMATS' }));
    main.appendChild(chk('purr-txt', 'Plain text (.txt)', true));
    main.appendChild(chk('purr-html', 'HTML web view (print → PDF)', false));
    main.appendChild(chk('purr-csv', 'CSV (spreadsheet)', false));

    main.appendChild(E('div', 'font-size:11px;letter-spacing:.5px;color:#8696a0;margin:10px 0 4px', { text: 'DATE RANGE (OPTIONAL)' }));
    var dRow = E('div', 'display:flex;gap:6px;align-items:center');
    dRow.appendChild(E('span', 'width:34px;color:#8696a0', { text: 'From' }));
    dRow.appendChild(E('input', 'flex:1;padding:5px;border-radius:6px;border:1px solid #2a3942;background:#182229;color:#e9edef', { type: 'date', id: 'purr-from' }));
    main.appendChild(dRow);
    var dRow2 = E('div', 'display:flex;gap:6px;align-items:center;margin-top:5px');
    dRow2.appendChild(E('span', 'width:34px;color:#8696a0', { text: 'To' }));
    dRow2.appendChild(E('input', 'flex:1;padding:5px;border-radius:6px;border:1px solid #2a3942;background:#182229;color:#e9edef', { type: 'date', id: 'purr-to' }));
    main.appendChild(dRow2);

    main.appendChild(E('div', 'font-size:11px;letter-spacing:.5px;color:#8696a0;margin:10px 0 4px', { text: 'OPTIONS' }));
    main.appendChild(chk('purr-media', 'Include media (best-effort images)', false));
    main.appendChild(chk('purr-dark', 'Dark mode for HTML', true));
    main.appendChild(chk('purr-participants', 'Export group participants', true));
    main.appendChild(chk('purr-contacts', 'Export contacts list', false));
    main.appendChild(chk('purr-zip', 'Bundle everything into one .zip', false));

    var runRow = E('div', 'display:flex;gap:6px;margin-top:12px');
    var bRun = E('button', 'flex:2;padding:10px;border:none;border-radius:8px;background:#00a884;color:#fff;font-weight:700;cursor:pointer', { id: 'purr-run', text: 'Export selected' });
    var bStop = E('button', 'flex:1;padding:10px;border:none;border-radius:8px;background:#3b2a2a;color:#f2a0a0;cursor:pointer', { id: 'purr-stop', text: 'Stop' });
    runRow.appendChild(bRun); runRow.appendChild(bStop); main.appendChild(runRow);

    var barWrap = E('div', 'height:7px;background:#2a3942;border-radius:6px;margin-top:10px;overflow:hidden');
    barWrap.appendChild(E('div', 'height:100%;width:0;background:#00a884;transition:width .2s', { id: 'purr-bar' })); main.appendChild(barWrap);
    main.appendChild(E('div', 'margin-top:6px;color:#8696a0;font-size:12px', { id: 'purr-status', text: 'Ready.' }));
    main.appendChild(E('div', 'margin-top:8px;max-height:110px;overflow:auto;background:#0b141a;border-radius:8px;padding:6px;font-size:11px;color:#8696a0;white-space:pre-wrap', { id: 'purr-log' }));

    body.appendChild(main);
    var foot = E('div', 'text-align:center;font-size:11px;color:#54656f;padding:8px 0 2px');
    foot.appendChild(E('span', '', { text: APP + ' v1.0.0 · by ' + WM }));
    body.appendChild(foot);
    panel.appendChild(body);
    document.body.appendChild(panel);

    ui = { panel: panel, dot: dot, gate: gate, main: main, chats: chatBox, bar: $('purr-bar'), status: $('purr-status'), log: $('purr-log'), count: $('purr-count') };
    bScan.onclick = scan; bAll.onclick = function () { selectAll(true); }; bNone.onclick = function () { selectAll(false); };
    bRun.onclick = run; bStop.onclick = function () { state.stop = true; log('Stop requested…'); };
  }

  function revealMain() { ui.gate.style.display = 'none'; ui.main.style.display = 'block'; ui.dot.style.background = '#00a884'; }
  function selectAll(v) { try { ui.chats.querySelectorAll('input[type=checkbox]').forEach(function (i) { i.checked = v; }); } catch (e) {} }

  function scan() {
    state.chats = listChats();
    ui.chats.textContent = '';
    if (!state.chats.length) { ui.chats.appendChild(E('div', 'color:#8696a0;text-align:center;padding:10px', { text: 'No chats found.' })); ui.count.textContent = ''; return; }
    state.chats.forEach(function (c, idx) {
      var row = E('label', 'display:flex;align-items:center;gap:7px;padding:3px 2px;cursor:pointer;border-bottom:1px solid #182229');
      var i = E('input', '', { type: 'checkbox' }); i.checked = true; i.setAttribute('data-idx', idx);
      row.appendChild(i);
      row.appendChild(E('span', '', { text: isGroup(c) ? '👥' : '👤' }));
      row.appendChild(E('span', 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', { text: chatTitle(c) }));
      ui.chats.appendChild(row);
    });
    ui.count.textContent = state.chats.length + ' chats found';
    log('Found ' + state.chats.length + ' chats.');
    status(state.chats.length + ' chats ready.');
  }
  function selectedIdx() { var out = []; try { ui.chats.querySelectorAll('input[type=checkbox]').forEach(function (i) { if (i.checked) out.push(parseInt(i.getAttribute('data-idx'), 10)); }); } catch (e) {} return out; }
  function dateBounds() {
    var f = ($('purr-from') || {}).value, t = ($('purr-to') || {}).value;
    return { fs: f ? Math.floor(new Date(f + 'T00:00:00').getTime() / 1000) : null, ts: t ? Math.floor(new Date(t + 'T23:59:59').getTime() / 1000) : null };
  }

  async function run() {
    if (state.running) return;
    if (!state.chats.length) scan();
    var idxs = selectedIdx();
    var wantTxt = checked('purr-txt'), wantHtml = checked('purr-html'), wantCsv = checked('purr-csv');
    var wantMedia = checked('purr-media'), dark = checked('purr-dark'), wantPart = checked('purr-participants');
    var wantContacts = checked('purr-contacts'), wantZip = checked('purr-zip');
    if (!idxs.length && !wantContacts) { log('Select at least one chat (or enable contacts).'); return; }
    if (!wantTxt && !wantHtml && !wantCsv && !wantContacts) { log('Select at least one format/output.'); return; }

    var useZip = wantZip && !!window.JSZip;
    if (wantZip && !window.JSZip) log('JSZip not loaded — downloading files individually.');
    var zip = useZip ? new window.JSZip() : null;
    var db = dateBounds();
    state.running = true; state.stop = false; setBar(0);
    var combined = ['chat,datetime,sender,fromMe,type,text'];
    var total = Math.max(idxs.length, 1), done = 0, grand = 0;

    for (var n = 0; n < idxs.length; n++) {
      if (state.stop) { log('Stopped.'); break; }
      var chat = state.chats[idxs[n]]; var title = chatTitle(chat);
      status('(' + (n + 1) + '/' + idxs.length + ') ' + title);
      var msgs = [];
      try { msgs = await fetchChatMessages(chat); } catch (e) { log('Failed to open: ' + title); }
      var rows = msgs.map(function (m) { return normalize(m, wantMedia); }).filter(function (r) {
        if (SKIP_TYPES[r.type]) return false;
        if (!r.text && !r.isMedia) return false;
        if (db.fs && r.t < db.fs) return false; if (db.ts && r.t > db.ts) return false; return true;
      });
      grand += rows.length;
      log(title + ': ' + rows.length + ' messages');

      var mediaMap = null;
      if (wantMedia && wantHtml) {
        mediaMap = {};
        for (var mi = 0; mi < rows.length; mi++) { if (state.stop) break; if (/^(image|sticker)$/.test(rows[mi].type)) { var du = await tryMediaDataUrl(rows[mi]._m); if (du) mediaMap[rows[mi].id] = du; } }
      }

      var base = safeName(title) + '_' + idOf(chat).replace(/[@.]/g, '_');
      var files = [];
      if (wantTxt) files.push([base + '.txt', toTxt(title, rows), 'text/plain']);
      if (wantHtml) files.push([base + '.html', toHtml(title, rows, dark, mediaMap), 'text/html']);
      if (wantCsv) files.push([base + '.csv', toCsv(title, rows), 'text/csv']);
      if (wantPart && isGroup(chat)) { var ps = participantsOf(chat); if (ps.length) files.push([base + '_participants.csv', 'name,number\n' + ps.map(function (p) { return csvEsc(p.name) + ',' + csvEsc(p.number || '(hidden)'); }).join('\n'), 'text/csv']); }
      rows.forEach(function (r) { combined.push([csvEsc(title), csvEsc(r.date), csvEsc(r.sender), r.fromMe ? '1' : '0', csvEsc(r.type), csvEsc(r.text)].join(',')); });

      if (useZip) { files.forEach(function (f) { zip.file(f[0], f[1]); }); }
      else { files.forEach(function (f) { dl(f[0], f[1], f[2]); }); }
      done++; setBar(idxs.length ? (done / idxs.length * 100) : 100);
      await sleep(cfg.betweenChats);
    }

    if (wantContacts) {
      var cc = exportContacts();
      if (useZip) zip.file('contacts.csv', cc); else dl('contacts.csv', cc, 'text/csv');
    }
    if (useZip) {
      if (idxs.length) zip.file('ALL_combined.csv', combined.join('\n'));
      zip.file('README.txt', APP + ' export\nGenerated: ' + new Date().toLocaleString() + '\nby ' + WM + ' — ' + REPO + '\n');
      status('Zipping…');
      var blob = await zip.generateAsync({ type: 'blob' });
      dl('purr-wa-export-' + Date.now() + '.zip', blob, 'application/zip');
    }
    status('Done. ' + grand + ' messages from ' + done + ' chats.');
    log('COMPLETE ✅ ' + grand + ' messages.');
    setBar(100); state.running = false;
  }

  function boot() {
    if (!document.body) { return setTimeout(boot, 300); }
    buildUI();
    var tries = 0;
    (function readyLoop() {
      tries++;
      if (isAuthed() && storeReady()) { revealMain(); log('Store ready. Click “Scan chats”.'); return; }
      if (tries > 600) log('Store not ready — make sure you are logged in, then refresh.');
      setTimeout(readyLoop, 500);
    })();
  }
  boot();

  // test hook (no-op in real use)
  window.__PURR = { scan: scan, run: run, listChats: listChats, exportContacts: exportContacts, state: state };
})();
