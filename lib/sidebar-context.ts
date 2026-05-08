"use client";
import { createContext, useContext } from "react";

export const SidebarContext = createContext<{
  open: boolean;
  toggle: () => void;
  close: () => void;
}>({ open: false, toggle: () => {}, close: () => {} });

export const useSidebar = () => useContext(SidebarContext);
