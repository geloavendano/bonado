import { Link } from "react-router-dom";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useBalances } from "@/hooks/useBalances";
import { formatMoney } from "@/lib/money";
import type { TripWithMembers } from "@/hooks/useTrip";

export function BalanceRail({ trip }: { trip: TripWithMembers }) {
  const { user } = useAuth();
  const { balances } = useBalances(trip.id);
  const yourBalance = balances.find((balance) => balance.user_id === user?.id)?.balance ?? 0;
  const others = trip.members
    .filter((member) => member.id !== user?.id)
    .map((member) => ({
      ...member,
      balance: balances.find((balance) => balance.user_id === member.id)?.balance ?? 0,
    }));

  return (
    <div className="sticky top-0 hidden h-dvh w-[260px] flex-none flex-col gap-3 overflow-y-auto border-l border-hairline px-5 py-6 lg:flex">
      <div className="px-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-secondary">
        Your balance
      </div>
      <div className="rounded-[16px] bg-teal-tint px-4 py-4 text-center">
        <div className="text-[19px] font-extrabold text-teal-dark">
          {yourBalance === 0
            ? "Settled up"
            : yourBalance > 0
              ? `+${formatMoney(yourBalance, trip.default_currency)}`
              : `−${formatMoney(-yourBalance, trip.default_currency)}`}
        </div>
        {yourBalance !== 0 && (
          <div className="mt-0.5 text-[11.5px] font-semibold text-teal-dark/70">
            {yourBalance > 0 ? "you're owed" : "you owe"}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <>
          <div className="mt-1 px-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-secondary">
            People
          </div>
          <div className="flex flex-col gap-2.5 px-1">
            {others.map((member) => (
              <div key={member.id} className="flex items-center gap-2.5 text-[13px]">
                <Avatar name={member.name} seed={member.id} avatarUrl={member.avatar_url} size={26} />
                <span className="min-w-0 flex-1 truncate font-semibold">{member.name}</span>
                <span
                  className={clsx(
                    "font-extrabold",
                    member.balance > 0
                      ? "text-owed"
                      : member.balance < 0
                        ? "text-owe"
                        : "text-secondary",
                  )}
                >
                  {member.balance === 0
                    ? "—"
                    : `${member.balance > 0 ? "+" : "−"}${formatMoney(
                        Math.abs(member.balance),
                        trip.default_currency,
                      )}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        to={`/trips/${trip.id}/balances`}
        className="mt-auto rounded-pill border-[1.5px] border-teal py-2.5 text-center text-[13px] font-bold text-teal-dark transition-colors hover:bg-teal-tint"
      >
        Settle up
      </Link>
    </div>
  );
}
