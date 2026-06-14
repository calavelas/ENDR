"use client";

import { forwardRef } from "react";

import * as Icon from "../icons";

interface LauncherProps {
  open: boolean;
  persona: string;
  onClick: () => void;
}

export const AssistantLauncher = forwardRef<HTMLButtonElement, LauncherProps>(
  function AssistantLauncher({ open, persona, onClick }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`asst-launcher${open ? " open" : ""}`}
        onClick={onClick}
        aria-expanded={open}
        aria-label={open ? "Minimize assistant" : `Open assistant (${persona})`}
      >
        {open ? <Icon.X size={22} /> : <Icon.Bot size={24} />}
      </button>
    );
  },
);
