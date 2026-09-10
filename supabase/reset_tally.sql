-- 一生二択：世界の投票数をゼロにリセットする（テスト票の掃除用）
-- Supabase SQL Editor で実行。全質問の集計が消え、次の投票から積み直しになる。
delete from public.nibutaku_tally;
