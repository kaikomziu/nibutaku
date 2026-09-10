// 一生二択 ─ 本体
(function () {
  "use strict";

  var Q = window.QUESTIONS || [];
  var Net = window.NibutakuNet || { online: false, fetchAll: function () { return Promise.resolve(null); }, vote: function () { return Promise.resolve(null); } };
  var SKEY = "nibutaku_v1";

  var $ = function (id) { return document.getElementById(id); };

  // ---- state ----
  var state = load();
  var serverTally = null; // { qid: {a,b} } サーバー集計
  var idx = 0;            // state.order 内の現在位置
  var revealed = false;

  function load() {
    try {
      var raw = localStorage.getItem(SKEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.answers && Array.isArray(s.order) && s.order.length === Q.length) return s;
      }
    } catch (e) {}
    return { answers: {}, order: shuffle(Q.map(function (q) { return q.id; })) };
  }
  function save() {
    try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch (e) {}
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function qById(id) { for (var i = 0; i < Q.length; i++) if (Q[i].id === id) return Q[i]; return null; }
  function answeredCount() { return Object.keys(state.answers).length; }

  // seed(種) + サーバー集計 を合算した {a,b}
  function combined(q) {
    var a = q.sa || 0, b = q.sb || 0;
    if (serverTally && serverTally[q.id]) { a += serverTally[q.id].a; b += serverTally[q.id].b; }
    return { a: a, b: b };
  }

  // ---- ?reset ----
  if (/[?&]reset\b/.test(location.search)) {
    try { localStorage.removeItem(SKEY); } catch (e) {}
    state = { answers: {}, order: shuffle(Q.map(function (q) { return q.id; })) };
    save();
  }

  // ---- screens ----
  function show(which) {
    ["intro", "game", "summary"].forEach(function (s) {
      $(s).classList.toggle("hide", s !== which);
    });
    window.scrollTo(0, 0);
  }

  // 次に出すべき質問(未回答の先頭)。全部回答済みなら -1
  function firstUnanswered() {
    for (var i = 0; i < state.order.length; i++) {
      if (!(state.order[i] in state.answers)) return i;
    }
    return -1;
  }

  function renderProgress() {
    $("pnum").textContent = (idx + 1) + " / " + Q.length;
    $("pfill").style.width = (answeredCount() / Q.length * 100) + "%";
    $("pans").textContent = "回答 " + answeredCount();
  }

  function renderQuestion() {
    revealed = false;
    var q = qById(state.order[idx]);
    if (!q) return;
    $("game").classList.remove("revealed");
    $("qtitle").textContent = "この二択、どっち？";
    $("txtA").textContent = q.a;
    $("txtB").textContent = q.b;
    $("btnA").disabled = false;
    $("btnB").disabled = false;
    $("btnA").classList.remove("picked");
    $("btnB").classList.remove("picked");
    $("pctA").textContent = "";
    $("pctB").textContent = "";
    $("btnA").querySelector(".fill").style.width = "0";
    $("btnB").querySelector(".fill").style.width = "0";
    $("verdict").innerHTML = "";
    $("tally").textContent = "";
    renderProgress();

    // すでに回答済みの質問なら、その結果をそのまま表示
    if (q.id in state.answers) reveal(q, state.answers[q.id], true);
  }

  function reveal(q, choice, instant) {
    revealed = true;
    $("game").classList.add("revealed");
    $("btnA").disabled = true;
    $("btnB").disabled = true;
    $("btnA").classList.toggle("picked", choice === 0);
    $("btnB").classList.toggle("picked", choice === 1);

    var c = combined(q);
    var total = c.a + c.b || 1;
    var pa = Math.round(c.a / total * 100);
    var pb = 100 - pa;
    $("pctA").textContent = pa + "%";
    $("pctB").textContent = pb + "%";

    var setW = function () {
      $("btnA").querySelector(".fill").style.width = pa + "%";
      $("btnB").querySelector(".fill").style.width = pb + "%";
    };
    if (instant) setW(); else setTimeout(setW, 60);

    var myPct = choice === 0 ? pa : pb;
    var otherPct = 100 - myPct;
    var vtxt;
    if (myPct > otherPct) vtxt = '世界の <span class="maj">' + myPct + '%</span> が、あなたと同じ選択';
    else if (myPct < otherPct) vtxt = 'あなたは <span class="min">少数派</span>。同じ選択は世界の ' + myPct + '%';
    else vtxt = '世界はちょうど真っ二つ（' + myPct + '% : ' + otherPct + '%）';
    $("verdict").innerHTML = vtxt;
    $("tally").textContent = "これまでに " + (c.a + c.b).toLocaleString() + " 人が回答";
  }

  function choose(choice) {
    if (revealed) return;
    var q = qById(state.order[idx]);
    if (!q) return;
    state.answers[q.id] = choice;
    save();
    reveal(q, choice, false);
    renderProgress();

    // サーバーに1票入れて最新値で微調整
    Net.vote(q.id, choice).then(function (res) {
      if (res) {
        serverTally = serverTally || {};
        serverTally[q.id] = res;
        if (revealed && state.order[idx] === q.id) reveal(q, choice, true);
      }
    });
  }

  function goNext() {
    var nx = firstUnanswered();
    if (nx === -1) { renderSummary(); show("summary"); return; }
    idx = nx;
    renderQuestion();
  }

  function skip() {
    // 今の質問を未回答のまま列の最後尾へ回す
    var id = state.order.splice(idx, 1)[0];
    state.order.push(id);
    save();
    var nx = firstUnanswered();
    idx = nx === -1 ? state.order.length - 1 : nx;
    renderQuestion();
  }

  function renderSummary() {
    var ids = Object.keys(state.answers);
    var maj = 0, min = 0;
    var rows = "";
    state.order.forEach(function (id) {
      if (!(id in state.answers)) return;
      var q = qById(id); if (!q) return;
      var choice = state.answers[id];
      var c = combined(q);
      var total = c.a + c.b || 1;
      var pa = Math.round(c.a / total * 100);
      var myPct = choice === 0 ? pa : 100 - pa;
      var isMaj = myPct > 50, tie = myPct === 50;
      if (isMaj) maj++; else if (!tie) min++;
      var label = tie ? '<span class="rp">五分五分</span>'
        : isMaj ? '<span class="rp maj">多数派 ' + myPct + '%</span>'
                : '<span class="rp min">少数派 ' + myPct + '%</span>';
      rows += '<div class="ritem"><div class="rq">' + esc(q.a) + " ／ " + esc(q.b) + '</div>' +
        '<div class="rpick">' + (choice === 0 ? "A" : "B") + '：' + esc(choice === 0 ? q.a : q.b) + label + '</div></div>';
    });
    $("sMaj").textContent = maj;
    $("sMin").textContent = min;
    $("sumline").textContent = ids.length < Q.length
      ? "回答 " + ids.length + " / " + Q.length + " 問"
      : "全 " + Q.length + " 問、選び終わりました";
    $("rlist").innerHTML = rows || '<div class="ritem">まだ何も選んでいません。</div>';
    $("contBtn").classList.toggle("hide", ids.length >= Q.length || ids.length === 0);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---- changelog ----
  (function clog() {
    var box = $("clbody"); if (!box || !window.CHANGELOG) return;
    box.innerHTML = window.CHANGELOG.map(function (e) {
      return "<h4>v" + e.v + " (" + e.date + ")</h4><ul>" +
        e.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
    }).join("");
  })();

  // ---- events ----
  $("startBtn").addEventListener("click", function () {
    idx = firstUnanswered();
    if (idx === -1) { renderSummary(); show("summary"); return; }
    show("game");
    renderQuestion();
  });
  $("btnA").addEventListener("click", function () { choose(0); });
  $("btnB").addEventListener("click", function () { choose(1); });
  $("nextBtn").addEventListener("click", goNext);
  $("skipBtn").addEventListener("click", skip);
  $("toSummary").addEventListener("click", function () { renderSummary(); show("summary"); });
  $("contBtn").addEventListener("click", function () {
    var nx = firstUnanswered();
    if (nx === -1) return;
    idx = nx; show("game"); renderQuestion();
  });
  $("againBtn").addEventListener("click", function () {
    state = { answers: {}, order: shuffle(Q.map(function (q) { return q.id; })) };
    save(); idx = 0; show("intro");
  });

  document.addEventListener("keydown", function (e) {
    if ($("game").classList.contains("hide")) return;
    if (!revealed && (e.key === "1" || e.key === "a" || e.key === "ArrowLeft")) choose(0);
    else if (!revealed && (e.key === "2" || e.key === "b" || e.key === "ArrowRight")) choose(1);
    else if (revealed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); goNext(); }
  });

  // ---- init ----
  if (answeredCount() > 0) $("sumline").textContent = "つづきから遊べます";
  var offMsg = "オフライン中：世界の割合はおおよその値で表示しています";
  if (!Net.online) { $("off1").textContent = offMsg; $("off2").textContent = offMsg; }

  Net.fetchAll().then(function (map) {
    if (map) {
      serverTally = map;
      if (!$("game").classList.contains("hide")) renderQuestion();
    } else if (Net.online) {
      $("off1").textContent = offMsg; $("off2").textContent = offMsg;
    }
  });

  show("intro");
})();
