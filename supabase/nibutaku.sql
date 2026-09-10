-- 一生二択 ─ 世界の投票集計
-- Supabaseプロジェクト kifnzvktwbomxthzvvgy の SQL Editor で一度だけ実行してください。
-- (隠語クイズ・めっちゃカメレオン・HOLD ON 等と相乗りのプロジェクトのため、
--  このサイト専用の接頭辞 "nibutaku_" のオブジェクトのみ扱います)

-- 質問ごとの A / B 累計票
create table if not exists public.nibutaku_tally (
  qid        text primary key,
  a_count    bigint not null default 0 check (a_count >= 0),
  b_count    bigint not null default 0 check (b_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.nibutaku_tally enable row level security;

-- 誰でも閲覧可(割合表示のため)。ロールは anon に限定しない
-- (kaikomziu.github.io は全ゲーム共通オリジンで authenticated JWT が飛ぶことがある)
drop policy if exists "nibutaku_tally_public_read" on public.nibutaku_tally;
create policy "nibutaku_tally_public_read"
  on public.nibutaku_tally for select using (true);
-- INSERT/UPDATE ポリシーは作らない。書き込みは下の SECURITY DEFINER 関数経由のみ。

-- 1票加算して最新の集計を返す
create or replace function public.nibutaku_vote(p_qid text, p_choice int)
returns table(a_count bigint, b_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_choice not in (0, 1) then
    raise exception 'p_choice must be 0 or 1';
  end if;
  if p_qid is null or char_length(p_qid) > 16 then
    raise exception 'bad qid';
  end if;

  insert into public.nibutaku_tally (qid, a_count, b_count)
  values (p_qid,
          case when p_choice = 0 then 1 else 0 end,
          case when p_choice = 1 then 1 else 0 end)
  on conflict (qid) do update set
    a_count = public.nibutaku_tally.a_count + case when p_choice = 0 then 1 else 0 end,
    b_count = public.nibutaku_tally.b_count + case when p_choice = 1 then 1 else 0 end,
    updated_at = now();

  return query
    select t.a_count, t.b_count
    from public.nibutaku_tally t
    where t.qid = p_qid;
end;
$$;

revoke all on function public.nibutaku_vote(text, int) from public;
grant execute on function public.nibutaku_vote(text, int) to anon, authenticated;

-- 種データ(公開直後でも割合が出るようにする想定値)は js/questions.js の sa/sb 側に持たせ、
-- クライアントが「種 + このテーブルの実投票」を合算して表示する。
-- そのためこのテーブルは空スタートで、実際の投票だけが積み上がる。
