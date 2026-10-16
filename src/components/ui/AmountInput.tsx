import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { formatAmountInput } from "@/lib/money";

type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Group the displayed digits while keeping form state and saved amounts unformatted. */
export function AmountInput({ value, onValueChange, ...props }: AmountInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const displayed = formatAmountInput(value);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !input.current) return;
    const rawPosition = pendingCaret.current;
    let position = 0;
    let digits = 0;
    while (position < displayed.length && digits < rawPosition) {
      if (displayed[position] !== ",") digits++;
      position++;
    }
    input.current.setSelectionRange(position, position);
    pendingCaret.current = null;
  });

  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="decimal"
      value={displayed}
      onChange={(event) => {
        const element = event.currentTarget;
        let raw = element.value.replaceAll(",", "");
        let caret = element.value.slice(0, element.selectionStart ?? element.value.length).replaceAll(",", "").length;
        const operation = (event.nativeEvent as InputEvent).inputType;
        // Backspacing/deleting a separator should delete the adjacent digit,
        // rather than immediately putting the same comma back under the caret.
        if (raw === value && operation?.startsWith("delete")) {
          const index = operation === "deleteContentBackward" ? caret - 1 : caret;
          if (index >= 0) {
            raw = raw.slice(0, index) + raw.slice(index + 1);
            if (operation === "deleteContentBackward") caret--;
          }
        }
        if (!/^-?\d*(\.\d*)?$/.test(raw)) return;
        pendingCaret.current = caret;
        onValueChange(raw);
      }}
    />
  );
}
