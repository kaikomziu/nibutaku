// 一生二択 ─ 世界の投票の集計(共有Supabase)
// プロジェクト kifnzvktwbomxthzvvgy は複数サイト相乗り。接頭辞 "nibutaku_" のみ扱う。
(function () {
  "use strict";

  var SB_URL = "https://kifnzvktwbomxthzvvgy.supabase.co";
  // ingo-kuizu と同じ JWT 形式 anon key(publishable key だと RPC/INSERT が 403 になる)
  var SB_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZm56dmt0d2JvbXh0aHp2dmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzgxMzgsImV4cCI6MjA5MzQxNDEzOH0.M7nXP-u--6J_6rRpgz1cJj21_7KX6MtfTmZy77Xf_IE";

  var sb = null;
  try {
    if (window.supabase) {
      // kaikomziu.github.io は全ゲーム共通オリジン。他ゲームの auth セッションを
      // 拾わないよう persistSession:false + Authorization ヘッダーで anon を強制。
      sb = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: "Bearer " + SB_KEY } },
      });
    }
  } catch (e) {
    console.warn("[nibutaku] supabase init failed", e);
  }

  var Net = {
    online: !!sb,

    // 全質問の現在の集計を { qid: {a, b} } で返す。失敗時は null。
    fetchAll: function () {
      if (!sb) return Promise.resolve(null);
      return sb
        .from("nibutaku_tally")
        .select("qid,a_count,b_count")
        .then(function (res) {
          if (res.error) throw res.error;
          var map = {};
          (res.data || []).forEach(function (r) {
            map[r.qid] = { a: Number(r.a_count) || 0, b: Number(r.b_count) || 0 };
          });
          return map;
        })
        .catch(function (e) {
          console.warn("[nibutaku] fetchAll failed", e);
          return null;
        });
    },

    // 1票投じて、その質問の最新集計 {a, b} を返す。失敗時は null。
    vote: function (qid, choice) {
      if (!sb) return Promise.resolve(null);
      return sb
        .rpc("nibutaku_vote", { p_qid: qid, p_choice: choice === 1 ? 1 : 0 })
        .then(function (res) {
          if (res.error) throw res.error;
          var row = Array.isArray(res.data) ? res.data[0] : res.data;
          if (!row) return null;
          return { a: Number(row.a_count) || 0, b: Number(row.b_count) || 0 };
        })
        .catch(function (e) {
          console.warn("[nibutaku] vote failed", e);
          return null;
        });
    },
  };

  window.NibutakuNet = Net;
})();
