import { BrowserWindow, ApplicationMenu } from "electrobun/bun"

const win = new BrowserWindow({
  title: "OpenTack",
  frame: {
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
  },
  url: "views://mainview/index.html",
})

ApplicationMenu.setApplicationMenu([
  {
    label: "OpenTack",
    submenu: [
      { role: "hide" },
      { role: "hideOthers" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "File",
    submenu: [
      { label: "New Ticket", accelerator: "n", action: "new-ticket" },
      { type: "separator" },
      { label: "Settings", accelerator: ",", action: "open-settings" },
      { type: "separator" },
      { role: "close" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "delete" },
      { type: "separator" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "toggleFullScreen" },
    ],
  },
  {
    label: "Help",
    submenu: [
      { label: "About OpenTack", action: "about" },
    ],
  },
])
