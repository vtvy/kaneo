import { useEffect } from "react";
import { useInstanceNameStore } from "@/store/instance-name";

type PageTitleProps = {
  title: string;
  suffix?: string;
  hideAppName?: boolean;
};

export default function PageTitle({
  title,
  suffix,
  hideAppName = false,
}: PageTitleProps) {
  const instanceName = useInstanceNameStore((state) => state.instanceName);
  const appName = suffix ?? instanceName;

  useEffect(() => {
    const formattedTitle = hideAppName
      ? title
      : appName
        ? `${title} — ${appName}`
        : title;
    document.title = formattedTitle;
  }, [title, appName, hideAppName]);

  return null;
}
