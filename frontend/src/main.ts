import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";

import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import "./styles.css";

function readThemeMode(): "light" | "dark" {
  const stored = localStorage.getItem("ui_theme_mode");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("ui_theme_mode", mode);
}

applyTheme(readThemeMode());

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.use(i18n);
app.mount("#app");
