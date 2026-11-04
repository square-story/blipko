"use client";

import { DIcons } from "dicons";
import { useTheme } from "next-themes";
import { switchTheme } from "@/lib/theme-transition";

function handleScrollTop() {
  window.scroll({
    top: 0,
    behavior: "smooth",
  });
}

const ThemeToogle = () => {
  const { setTheme } = useTheme();

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center rounded-full border border-dotted">
        <button
          onClick={(e) => switchTheme(() => setTheme("light"), e.currentTarget)}
          className="bg-black mr-3 rounded-full p-2 text-white dark:bg-background dark:text-white"
        >
          <DIcons.Sun className="h-5 w-5" strokeWidth={1} />
          <span className="sr-only">T</span>
        </button>

        <button type="button" onClick={handleScrollTop}>
          <DIcons.ArrowUp className="h-3 w-3" />
          <span className="sr-only">Top</span>
        </button>

        <button
          onClick={(e) => switchTheme(() => setTheme("dark"), e.currentTarget)}
          className="dark:bg-black ml-3 rounded-full p-2 text-black dark:text-white"
        >
          <DIcons.Moon className="h-5 w-5" strokeWidth={1} />
          <span className="sr-only">T</span>
        </button>
      </div>
    </div>
  );
};

export default ThemeToogle;
