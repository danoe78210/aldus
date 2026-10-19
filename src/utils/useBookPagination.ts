import { useEffect, useState } from "react";
import type { PaginationResult, ProjectFile } from "../types";
import { getBookPagination } from "./projectApi";
import { isInvokeAvailable, listenEvent } from "./tauri";

export const useBookPagination = (project: ProjectFile | null, sourceRevision: number) => {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; result: PaginationResult | null; error: string | null }>();
  const serializedProject = project ? JSON.stringify({ ...project, cover: undefined, fileCache: undefined }) : null;
  const key = JSON.stringify([serializedProject, sourceRevision, revision]);

  useEffect(() => {
    if (!isInvokeAvailable()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    const refresh = () => setRevision((value) => value + 1);
    void listenEvent("book-pagination-changed", refresh).then((off) => {
      if (disposed) off?.();
      else unlisten = off;
    });
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!serializedProject || !isInvokeAvailable()) return;
    const payload: ProjectFile = JSON.parse(serializedProject);
    let active = true;
    const timer = window.setTimeout(() => {
      void getBookPagination(payload).then(
        (result) => { if (active) setState({ key, result, error: null }); },
        (error: unknown) => { if (active) setState({ key, result: null, error: String(error) }); },
      );
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, serializedProject]);

  return state?.key === key ? state : { result: null, error: null };
};
