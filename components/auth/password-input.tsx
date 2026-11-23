"use client";

import { useState, type ComponentPropsWithoutRef } from "react";

export function PasswordInput({ className, ...props }: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <input {...props} type={visible ? "text" : "password"} spellCheck={false}
        autoCapitalize="none" autoCorrect="off" className={`${className ?? ""} min-h-12 w-full pr-20`} />
      <button type="button" disabled={props.disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((previous) => !previous)}
        className="absolute inset-y-0 right-1 my-auto min-h-11 rounded-lg px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-800">
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
