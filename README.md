# 一生二択

一生に関わる「絶妙に悩む二択」をひたすら選ぶだけのサイト。
選ぶと **世界の何%が同じ方を選んだか** がわかる。全521問。

公開URL: https://kaikomziu.github.io/nibutaku/

## 遊び方

- **ランダムで始める**: 未回答の質問からランダムに1問ずつ出題（エンドレス）。
- **気になる質問を選ぶ**: 12カテゴリの絞り込み＋キーワード検索で、好きな質問を直接開く。
- 1問1回だけ投票。回答済みの質問は結果（自分の選択と世界の割合）を見返せる。
- `?reset` で自分の回答をリセット。

## 構成

- `index.html` … 単一ページ。インラインCSS。
- `js/questions.js` … `tools/gen.js` が自動生成。`window.QUESTIONS`（{id,cat,a,b}）と
  `window.CATEGORIES`、`window.seedSplit(id)`（種割合を id から決定論的に生成）。
- `tools/gen.js` … 手書きの質問＋テンプレート合成で `js/questions.js` を再生成。
  `node tools/gen.js` で実行。質問を足す時は HAND 配列 or 各プールに追記。
- `js/net.js` … 共有Supabase（`nibutaku_tally` + `nibutaku_vote` RPC）で世界の投票を集計。
- `js/app.js` … ランダム出題・一覧・投票・結果表示。
- `js/version.js` … 更新履歴。
- `supabase/nibutaku.sql` … テーブルとRPCの定義。プロジェクト `kifnzvktwbomxthzvvgy` で一度だけ実行。

## 割合の仕組み

表示する割合 = `seedSplit(id)` の種 ＋ `nibutaku_tally` の実投票、の合算。
種はサーバーには入れず、クライアントだけが持つ（二重加算防止）。
実際の投票が積み上がるほど種の影響は薄まる。Supabase未接続時は種だけで表示。

## デプロイ

`main` ブランチが GitHub Pages で配信される。変更したら push。
