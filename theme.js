import { createContext, useContext } from "react";

export const DARK_THEME = {
  name: "dark",
  bg: "#0f1115",
  panel: "#171a1f",
  border: "#2a2f38",
  ink: "#e7e9ee",
  muted: "#9aa1ac",
  placeholder: "#6b7280",
  accent: "#185FA5",
  danger: "#A32D2D",
  statusBarStyle: "light",
};

export const LIGHT_THEME = {
  name: "light",
  bg: "#ffffff",
  panel: "#f4f5f6",
  border: "#e2e5e9",
  ink: "#14171c",
  muted: "#6b7280",
  placeholder: "#9aa1ac",
  accent: "#185FA5",
  danger: "#c23b3b",
  statusBarStyle: "dark",
};

export const THEME_STORAGE_KEY = "tracker_theme";

export const ThemeContext = createContext({
  theme: DARK_THEME,
  themeName: "dark",
  setThemeName: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
