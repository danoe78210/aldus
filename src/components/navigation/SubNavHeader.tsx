import React from "react";
import type { ActiveMenu } from "../../types";
import { poleOf } from "./poles";

interface SubNavHeaderProps {
  activeMenu: ActiveMenu;
  onSelect: (menu: ActiveMenu) => void;
}

export const SubNavHeader: React.FC<SubNavHeaderProps> = ({ activeMenu, onSelect }) => {
  const pole = poleOf(activeMenu);
  return (
    <nav
      aria-label={`Sous-navigation — ${pole.label}`}
      className="relative z-20 flex h-11 w-full shrink-0 items-stretch gap-1 border-b border-[#2e261c] bg-[#151518] pr-6 pl-40"
    >
      {pole.views.map((view) => {
        const active = view.id === activeMenu;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelect(view.id)}
            aria-current={active ? "page" : undefined}
            className={`relative px-4 font-serif text-[11px] tracking-widest uppercase transition-colors duration-150 ${
              active
                ? "text-[#d4af37] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[#d4af37]"
                : "text-[#bda888]/80 hover:text-[#d4af37]"
            }`}
          >
            {view.label}
          </button>
        );
      })}
    </nav>
  );
};
