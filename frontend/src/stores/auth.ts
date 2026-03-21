import { defineStore } from "pinia";
import http from "../api/http";

export interface User {
  id: number;
  name: string;
  email: string;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem("token") || "",
    user: null as User | null,
  }),
  actions: {
    async login(email: string, password: string) {
      const { data } = await http.post("/api/auth/login", { email, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem("token", data.token);
    },
    async sendRegisterEmailCode(email: string) {
      await http.post("/api/auth/register/email-code", { email });
    },
    async register(name: string, email: string, password: string, verificationCode: string) {
      await http.post("/api/auth/register", {
        name,
        email,
        password,
        verification_code: verificationCode,
      });
    },
    async fetchMe() {
      if (!this.token) return;
      const { data } = await http.get("/api/auth/me");
      this.user = data;
    },
    async logout() {
      if (this.token) {
        await http.post("/api/auth/logout");
      }
      this.token = "";
      this.user = null;
      localStorage.removeItem("token");
    },
  },
});
