import { create } from "zustand";
type Tab = "users" | "roles" | "acl" | "audit";
export const useUi = create<{
  tab: Tab;
  selectedUser: string;
  setTab: (tab: Tab) => void;
  selectUser: (id: string) => void;
  reset: () => void;
}>((set) => ({
  tab: "users",
  selectedUser: "",
  setTab: (tab) => set({ tab }),
  selectUser: (selectedUser) => set({ selectedUser }),
  reset: () => set({ tab: "users", selectedUser: "" }),
}));
