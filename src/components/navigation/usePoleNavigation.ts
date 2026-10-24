import { useCallback, useRef, useState } from "react";
import type { ActiveMenu, NavPole } from "../../types";
import { DEFAULT_VIEW_BY_POLE, poleOf } from "./poles";

export const usePoleNavigation = (initial: ActiveMenu) => {
  const [activeMenu, setMenu] = useState<ActiveMenu>(initial);
  const lastViewByPole = useRef<Record<NavPole, ActiveMenu>>({
    ...DEFAULT_VIEW_BY_POLE,
    [poleOf(initial).id]: initial,
  });

  const setActiveMenu = useCallback((menu: ActiveMenu) => {
    lastViewByPole.current[poleOf(menu).id] = menu;
    setMenu(menu);
  }, []);

  const setActivePole = useCallback(
    (pole: NavPole) => setActiveMenu(lastViewByPole.current[pole]),
    [setActiveMenu],
  );

  return { activeMenu, setActiveMenu, setActivePole };
};
