import React from "react";

interface PendingViewProps {
  title: string;
  hint: string;
}

export const PendingView: React.FC<PendingViewProps> = ({ title, hint }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-10 text-center">
    <h2 className="font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">{title}</h2>
    <p className="max-w-md font-serif text-sm italic text-[#bda888]">{hint}</p>
    <p className="font-serif text-xs tracking-widest text-[#8f6e2b] uppercase">En cours de composition</p>
  </div>
);
