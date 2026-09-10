// 一生二択 ─ 本体
(function () {
  "use strict";

  var Q = window.QUESTIONS || [];
  var CATS = window.CATEGORIES || [{ key: "all", label: "すべて", emoji: "🎲" }];
  var Net = window.NibutakuNet || {
    online: false,
    fetchAll: function () { return Promise.resolve(null); },
    vote: function () { return Promise.resolve(null); },
  };
  var SKEY = "nibutaku_v1";
  var $ = function (id) { return document.getElementById(id); };

  var qmap = {};
  Q.forEach(function (q) { qmap[q.id] = q; });

  var state = load();
  var serverTally = null;      // { qid: {a,b} }（実投票のみ）
  var serverOk = false;        // fetchAll か vote が一度でも成功したか
  var current = null;          // 表示中の qid
  var returnTo = "random";     // "random" | "browse"
  var revealed = false;
  var browseCat = "all";
  var browseLimit = 40;

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(SKEY) || "{}");
      if (s && s.answers && typeof s.answers === "object") return { answers: s.answers };
    } catch (e) {}
    return { answers: {} };
  }
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch (e) {} }
  function answeredCount() { return Object.keys(state.answers).length; }
  function catLabel(k) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].key === k) return CATS[i].emoji + " " + CATS[i].label;
    return k;
  }

  // 表示する割合は「実際に人が選んだ票」だけで算出する（種データは使わない）
  function tallyOf(q) {
    var t = (serverTally && serverTally[q.id]) || { a: 0, b: 0 };
    return { a: t.a || 0, b: t.b || 0, total: (t.a || 0) + (t.b || 0) };
  }
  var MIN_VOTES = 5; // これ未満は割合を表示しない
  // 票が MIN_VOTES 未満なら null。あれば A の割合(%)
  function pctA(q) {
    var t = tallyOf(q);
    if (t.total < MIN_VOTES) return null;
    return Math.round(t.a / t.total * 100);
  }

  if (/[?&]reset\b/.test(location.search)) {
    try { localStorage.removeItem(SKEY); } catch (e) {}
    state = { answers: {} };
  }

  function show(which) {
    ["intro", "game", "browse", "summary"].forEach(function (s) {
      $(s).classList.toggle("hide", s !== which);
    });
    window.scrollTo(0, 0);
  }

  function pickRandom() {
    var pool = Q.filter(function (q) { return !(q.id in state.answers); });
    if (!pool.length) pool = Q;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  // ---- 質問画面 ----
  function openQuestion(qid, from) {
    current = qid;
    returnTo = from || "random";
    revealed = false;
    var q = qmap[qid];
    if (!q) return;
    $("game").classList.remove("revealed");
    $("qcat").textContent = catLabel(q.cat);
    $("qans").textContent = "回答 " + answeredCount();
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
    $("nextBtn").textContent = returnTo === "browse" ? "一覧にもどる" : "つぎの質問へ";
    $("skipBtn").style.display = returnTo === "browse" ? "none" : "";
    show("game");
    if (q.id in state.answers) reveal(q, state.answers[q.id], true);
  }

  function reveal(q, choice, instant) {
    revealed = true;
    $("game").classList.add("revealed");
    $("btnA").disabled = true;
    $("btnB").disabled = true;
    $("btnA").classList.toggle("picked", choice === 0);
    $("btnB").classList.toggle("picked", choice === 1);

    var t = tallyOf(q);
    var setW = function (pa) {
      $("btnA").querySelector(".fill").style.width = (pa == null ? 0 : pa) + "%";
      $("btnB").querySelector(".fill").style.width = (pa == null ? 0 : 100 - pa) + "%";
    };
    $("pctA").textContent = "";
    $("pctB").textContent = "";

    // サーバーに繋がっていない → 世界の割合は出せない
    if (!serverOk) {
      setW(null);
      $("verdict").innerHTML = '<span class="min">オフライン</span>：世界の割合はいま取得できません';
      $("tally").textContent = "";
      return;
    }
    // まだ票がほとんど無い（自分の1票のみ or ゼロ）
    if (t.total <= 1) {
      setW(null);
      $("verdict").innerHTML = 'あなたが <span class="min">最初の1人</span>。ここから世界の割合が集まります';
      $("tally").textContent = "";
      return;
    }
    // 数票だけ → 割合はまだ出さない
    if (t.total < MIN_VOTES) {
      setW(null);
      $("verdict").innerHTML = 'まだ集計中（回答 <span class="min">' + t.total + '</span> 件）。もう少し集まると割合が出ます';
      $("tally").textContent = "";
      return;
    }

    var pa = Math.round(t.a / t.total * 100), pb = 100 - pa;
    $("pctA").textContent = pa + "%";
    $("pctB").textContent = pb + "%";
    if (instant) setW(pa); else setTimeout(function () { setW(pa); }, 60);

    var my = choice === 0 ? pa : pb, other = 100 - my, txt;
    if (t.total < 30) {
      txt = 'いまのところ <span class="min">' + my + '%</span> があなたと同じ（回答 ' + t.total + ' 件）';
    } else if (my > other) {
      txt = '世界の <span class="maj">' + my + '%</span> が、あなたと同じ選択';
    } else if (my < other) {
      txt = 'あなたは <span class="min">少数派</span>。同じ選択は世界の ' + my + '%';
    } else {
      txt = '世界はちょうど真っ二つ（' + my + '% : ' + other + '%）';
    }
    $("verdict").innerHTML = txt;
    $("tally").textContent = "これまでに " + t.total.toLocaleString() + " 人が回答";
  }

  function choose(choice) {
    if (revealed || !current) return;
    var q = qmap[current];
    state.answers[q.id] = choice;
    save();
    // 自分の1票を先に反映（サーバー応答を待たずに割合を出す）
    serverTally = serverTally || {};
    var cur = serverTally[q.id] || { a: 0, b: 0 };
    serverTally[q.id] = {
      a: (cur.a || 0) + (choice === 0 ? 1 : 0),
      b: (cur.b || 0) + (choice === 1 ? 1 : 0),
    };
    reveal(q, choice, false);
    $("qans").textContent = "回答 " + answeredCount();
    Net.vote(q.id, choice).then(function (res) {
      if (res) {
        serverOk = true;
        serverTally[q.id] = res;
        if (revealed && current === q.id) reveal(q, choice, true);
      }
    });
  }

  function nextAction() {
    if (returnTo === "browse") { show("browse"); renderList(); return; }
    openQuestion(pickRandom(), "random");
  }

  // ---- 一覧画面 ----
  function renderChips() {
    $("chips").innerHTML = CATS.map(function (c) {
      var n = c.key === "all" ? Q.length : Q.filter(function (q) { return q.cat === c.key; }).length;
      return '<button class="chip' + (c.key === browseCat ? " on" : "") + '" data-k="' + c.key + '">' +
        c.emoji + " " + c.label + " " + n + "</button>";
    }).join("");
    Array.prototype.forEach.call($("chips").children, function (el) {
      el.addEventListener("click", function () {
        browseCat = el.dataset.k;
        browseLimit = 40;
        renderChips();
        renderList();
      });
    });
  }

  function browseFiltered() {
    var kw = ($("bsearch").value || "").trim();
    return Q.filter(function (q) {
      if (browseCat !== "all" && q.cat !== browseCat) return false;
      if (kw && (q.a + q.b).indexOf(kw) < 0) return false;
      return true;
    });
  }

  function renderList() {
    var list = browseFiltered();
    var doneN = list.filter(function (q) { return q.id in state.answers; }).length;
    $("bcount").textContent = list.length + " 問（回答済み " + doneN + "）";
    var slice = list.slice(0, browseLimit);
    $("qlist").innerHTML = slice.map(function (q) {
      var mk = '<span class="mk non">未回答</span>';
      if (q.id in state.answers) {
        var choice = state.answers[q.id], pa = pctA(q);
        if (pa == null) {
          mk = '<span class="mk non">' + (choice === 0 ? "A" : "B") + ' 回答ずみ</span>';
        } else {
          var my = choice === 0 ? pa : 100 - pa;
          var cls = my > 50 ? "maj" : (my < 50 ? "min" : "non");
          mk = '<span class="mk ' + cls + '">' + (choice === 0 ? "A" : "B") + " " + my + '%</span>';
        }
      }
      return '<button class="qrow" data-id="' + q.id + '"><span class="qtext">' +
        esc(q.a) + " ／ " + esc(q.b) + "</span>" + mk + "</button>";
    }).join("");
    Array.prototype.forEach.call($("qlist").children, function (el) {
      el.addEventListener("click", function () { openQuestion(el.dataset.id, "browse"); });
    });
    $("bmore").classList.toggle("hide", browseLimit >= list.length);
  }

  function openBrowse() { show("browse"); renderChips(); renderList(); }

  // ---- 結果まとめ ----
  function renderSummary() {
    var ids = Object.keys(state.answers);
    var maj = 0, min = 0, rows = "";
    Q.forEach(function (q) {
      if (!(q.id in state.answers)) return;
      var choice = state.answers[q.id], pa = pctA(q);
      var label;
      if (pa == null) {
        label = '<span class="rp">集計待ち</span>';
      } else {
        var my = choice === 0 ? pa : 100 - pa;
        var tie = my === 50, isMaj = my > 50;
        if (!tie) { if (isMaj) maj++; else min++; }
        label = tie ? '<span class="rp">五分五分</span>'
          : isMaj ? '<span class="rp maj">多数派 ' + my + '%</span>'
                  : '<span class="rp min">少数派 ' + my + '%</span>';
      }
      rows += '<div class="ritem"><div class="rq">' + esc(q.a) + " ／ " + esc(q.b) +
        '</div><div class="rpick">' + (choice === 0 ? "A" : "B") + "：" +
        esc(choice === 0 ? q.a : q.b) + label + "</div></div>";
    });
    $("sMaj").textContent = maj;
    $("sMin").textContent = min;
    $("sumline").textContent = ids.length === 0
      ? "まだ何も選んでいません"
      : "これまでに " + ids.length + " 問に回答（全 " + Q.length + " 問）";
    $("rlist").innerHTML = rows;
    $("contBtn").classList.toggle("hide", ids.length >= Q.length);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  (function () {
    var box = $("clbody");
    if (box && window.CHANGELOG) {
      box.innerHTML = window.CHANGELOG.map(function (e) {
        return "<h4>v" + e.v + " (" + e.date + ")</h4><ul>" +
          e.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
      }).join("");
    }
  })();

  function updateResume() {
    var n = answeredCount();
    $("resume").textContent = n > 0 ? "これまで " + n + " 問に回答ずみ（続きから遊べます）" : "";
    $("qtotal").textContent = Q.length;
  }

  // ---- イベント ----
  $("startRandom").addEventListener("click", function () { openQuestion(pickRandom(), "random"); });
  $("startBrowse").addEventListener("click", openBrowse);
  $("btnA").addEventListener("click", function () { choose(0); });
  $("btnB").addEventListener("click", function () { choose(1); });
  $("nextBtn").addEventListener("click", nextAction);
  $("skipBtn").addEventListener("click", function () { openQuestion(pickRandom(), "random"); });
  $("gameToBrowse").addEventListener("click", openBrowse);
  $("home").addEventListener("click", function () { updateResume(); show("intro"); });
  $("toBrowse").addEventListener("click", openBrowse);
  $("toBrowse2").addEventListener("click", openBrowse);
  $("toSummary").addEventListener("click", function () { renderSummary(); show("summary"); });
  $("contBtn").addEventListener("click", function () { openQuestion(pickRandom(), "random"); });
  $("againBtn").addEventListener("click", function () {
    if (confirm("回答をすべて消します。よろしいですか？")) {
      state = { answers: {} }; save(); updateResume(); renderSummary();
    }
  });
  $("bsearch").addEventListener("input", function () { browseLimit = 40; renderList(); });
  $("bmore").addEventListener("click", function () { browseLimit += 60; renderList(); });

  document.addEventListener("keydown", function (e) {
    if ($("game").classList.contains("hide")) return;
    if (!revealed && (e.key === "1" || e.key === "a" || e.key === "ArrowLeft")) choose(0);
    else if (!revealed && (e.key === "2" || e.key === "b" || e.key === "ArrowRight")) choose(1);
    else if (revealed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); nextAction(); }
  });

  // ---- 初期化 ----
  updateResume();
  var offMsg = "オフライン：世界の割合は表示できません（回答は端末に保存されます）";
  if (!Net.online) { $("off1").textContent = offMsg; $("off2").textContent = offMsg; }

  Net.fetchAll().then(function (map) {
    if (map) {
      serverOk = true;
      // すでにこのセッションで投票して serverTally がある場合は上書きしない
      if (!serverTally) serverTally = map;
      else Object.keys(map).forEach(function (k) { if (!(k in serverTally)) serverTally[k] = map[k]; });
      $("off1").textContent = "";
      $("off2").textContent = "";
      if (!$("game").classList.contains("hide") && current) {
        var q = qmap[current];
        if (q && q.id in state.answers) reveal(q, state.answers[q.id], true);
      }
      if (!$("browse").classList.contains("hide")) renderList();
    } else {
      $("off1").textContent = offMsg;
      $("off2").textContent = offMsg;
    }
  });

  show("intro");
})();
