import { useEffect } from "react";

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title}, VinFix`;
  }, [title]);

  return null;
}
