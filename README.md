# 一生二択

一生に関わる「絶妙に悩む二択」をひたすら選ぶだけのサイト。
選ぶと **世界の何%が同じ方を選んだか** がわかる。全50問。

公開URL: https://kaikomziu.github.io/nibutaku/

## 構成

- `index.html` … 単一ページ。インラインCSS。
- `js/questions.js` … 質問50問。`sa`/`sb` は「種」となる想定投票数（オフライン時／公開直後の割合表示に使用）。
- `js/net.js` … 共有Supabase（`nibutaku_tally` + `nibutaku_vote` RPC）で世界の投票を集計。
- `js/app.js` … 画面遷移・投票・結果表示・まとめ。
- `js/version.js` … 更新履歴。
- `supabase/nibutaku.sql` … テーブルとRPCの定義。プロジェクト `kifnzvktwbomxthzvvgy` で一度だけ実行。

## 仕組み

- 表示する割合 = `questions.js` の種（sa/sb） + `nibutaku_tally` の実投票、の合算。
  実際の投票が積み上がるほど種の影響は薄まる。
- 1問1回だけ投票（`localStorage: nibutaku_v1`）。回答済みの質問は結果だけ見返せる。
- `?reset` で自分の回答をリセット。
- Supabaseに繋がらない時は種データだけでおおよその割合を表示。

## デプロイ

`main` ブランチが GitHub Pages で配信される。変更したら push。
