import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { BiMoon, BiSun } from "react-icons/bi";

export const ThemeSwitcher = () => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="flex items-center justify-center mx-4">
            {theme === "light" ? (
                <BiMoon
                    className="cursor-pointer text-gray-600 dark:text-gray-300"
                    size={25}
                    onClick={toggleTheme}
                />
            ) : (
                <BiSun
                    className="cursor-pointer text-yellow-400 dark:text-yellow-300"
                    size={25}
                    onClick={toggleTheme}
                />
            )}
        </div>
    );
};
