-- Phase 14.8: convert legacy @Display Name mentions to stable @[user_id]
-- tokens. The comment_mentions join table is the source of truth, so renames
-- no longer break rendering.

do $$
declare
  v_mention record;
begin
  for v_mention in
    select cm.comment_id, cm.user_id, u.name
    from bonado.comment_mentions cm
    join bonado.users u on u.id = cm.user_id
    order by length(u.name) desc
  loop
    update bonado.comments
    set body = replace(
      body,
      '@' || v_mention.name,
      '@[' || v_mention.user_id::text || ']'
    )
    where id = v_mention.comment_id
      and body like '%@' || v_mention.name || '%'
      and body not like '%@[' || v_mention.user_id::text || ']%';
  end loop;
end;
$$;

