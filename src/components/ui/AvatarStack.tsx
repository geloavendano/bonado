import { Avatar } from "./Avatar";

interface StackPerson {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface AvatarStackProps {
  people: StackPerson[];
  size?: number;
  max?: number;
}

export function AvatarStack({ people, size = 30, max = 5 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const overlap = -Math.round(size * 0.3);

  return (
    <div className="flex items-center">
      {shown.map((person, i) => (
        <Avatar
          key={person.id}
          name={person.name}
          seed={person.id}
          avatarUrl={person.avatar_url}
          size={size}
          ring="white"
          className={i > 0 ? "" : undefined}
          style={i > 0 ? { marginLeft: overlap } : undefined}
        />
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full border-2 border-card bg-track flex items-center justify-center font-bold text-secondary flex-none"
          style={{
            width: size,
            height: size,
            fontSize: Math.max(10, size * 0.36),
            marginLeft: overlap,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
