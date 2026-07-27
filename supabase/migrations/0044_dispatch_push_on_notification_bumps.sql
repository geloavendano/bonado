-- Push delivery originally fired only when a notification row was inserted.
-- The in-app inbox intentionally reuses unread rows for the same
-- user/kind/transaction by bumping created_at, so those visible inbox updates
-- also need to dispatch native push.

drop trigger if exists notifications_push_dispatch_on_update on bonado.notifications;

create trigger notifications_push_dispatch_on_update
after update of created_at, actor_id, comment_id on bonado.notifications
for each row
when (
  new.read_at is null
  and old.created_at is distinct from new.created_at
)
execute function bonado.dispatch_push_notification();
