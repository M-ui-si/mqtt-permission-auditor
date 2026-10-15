"""Launch the local Agnes Harness Web interface for this package."""

from __future__ import annotations

import os
import queue
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, scrolledtext


PROFILE = "local-dev"
PORTS = range(4180, 4191)
URL_PATTERN = re.compile(r"http://127\.0\.0\.1:\d+/?")


def package_root() -> Path:
    return Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve().parent


def harness_cli(root: Path) -> Path | None:
    configured = os.environ.get("AGH_SOURCE")
    candidates = []
    if configured:
        candidates.append(Path(configured) / "packages" / "cli" / "dist" / "local" / "agnes.mjs")
    candidates.extend(
        [
            root / "vendor" / "agnes-harness" / "packages" / "cli" / "dist" / "local" / "agnes.mjs",
            Path(r"D:\AGH\vendor\agnes-harness\packages\cli\dist\local\agnes.mjs"),
        ]
    )
    return next((item for item in candidates if item.is_file()), None)


def node_command(root: Path, cli: Path) -> str | None:
    checkout_root = cli.parents[4] if len(cli.parents) > 4 else cli.parent
    candidates = [
        root / ".tools" / "node24" / "node.exe",
        checkout_root / ".tools" / "node24" / "node.exe",
        Path(r"D:\AGH\.tools\node24\node.exe"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return shutil.which("node")


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


class AghLauncher(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("MQTT 权限迁移审计器")
        self.geometry("700x460")
        self.minsize(580, 360)
        self.root_dir = package_root()
        self.events: queue.Queue[tuple[str, str]] = queue.Queue()
        self.server: subprocess.Popen[str] | None = None
        self.owns_service = False
        self.node: str | None = None
        self.cli: Path | None = None
        self.home = self.root_dir / ".local" / "agh-local-dev"
        self.url: str | None = None
        self.busy = False

        tk.Label(self, text="MQTT 权限迁移审计器", font=("Segoe UI", 16, "bold")).pack(
            anchor="w", padx=16, pady=(14, 2)
        )
        tk.Label(
            self,
            text="启动本机项目 Web 界面，并在浏览器打开本地地址。",
            font=("Segoe UI", 9),
        ).pack(anchor="w", padx=16, pady=(0, 10))

        row = tk.Frame(self)
        row.pack(fill="x", padx=16, pady=(0, 8))
        self.start_button = tk.Button(row, text="一键启动本地界面", command=self.start, height=2, width=18)
        self.start_button.pack(side="left")
        self.open_button = tk.Button(row, text="打开网址", command=self.open_url, height=2, width=12, state="disabled")
        self.open_button.pack(side="left", padx=(8, 0))
        self.stop_button = tk.Button(row, text="停止本次服务", command=self.stop, height=2, width=14, state="disabled")
        self.stop_button.pack(side="left", padx=(8, 0))

        self.url_label = tk.Label(self, text="网址：尚未启动", fg="#174ea6", cursor="hand2", font=("Segoe UI", 11, "underline"))
        self.url_label.pack(anchor="w", padx=18, pady=(0, 8))
        self.url_label.bind("<Button-1>", lambda _event: self.open_url())
        self.output = scrolledtext.ScrolledText(self, wrap="word", state="disabled")
        self.output.pack(fill="both", expand=True, padx=16, pady=(0, 14))
        self.log(f"项目目录：{self.root_dir}")
        self.log("隔离运行配置目录：" + str(self.home))
        self.log("使用 local-dev profile；不会复制或读取其他目录中的模型凭据。")
        self.protocol("WM_DELETE_WINDOW", self.close_window)
        self.after(100, self.read_events)
        # Double-clicking the EXE starts the service immediately; the window then
        # reports the URL and provides open/stop controls.
        self.after(250, self.start)

    def log(self, text: str) -> None:
        self.output.configure(state="normal")
        self.output.insert("end", text.rstrip() + "\n")
        self.output.see("end")
        self.output.configure(state="disabled")

    def start(self) -> None:
        if self.busy or (self.server and self.server.poll() is None):
            return
        self.busy = True
        self.start_button.configure(state="disabled")
        self.open_button.configure(state="disabled")
        threading.Thread(target=self.start_service, daemon=True).start()

    def start_service(self) -> None:
        try:
            existing = self.find_running_agh()
            if existing:
                self.events.put(("log", "检测到已运行的本地 Web 服务，直接复用。"))
                self.events.put(("url", existing))
                return
            self.cli = harness_cli(self.root_dir)
            if not self.cli:
                raise RuntimeError(
                    "找不到 Agnes Harness。请将固定版本源码放到 vendor/agnes-harness，"
                    "或设置 AGH_SOURCE 指向其源码目录。"
                )
            self.node = node_command(self.root_dir, self.cli)
            if not self.node:
                raise RuntimeError("找不到 Node.js 24.10+。请安装 Node.js，或在 AGH 检出目录保留 .tools/node24/node.exe。")
            version_result = subprocess.run(
                [self.node, "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10
            )
            version = tuple(int(part) for part in re.findall(r"\d+", version_result.stdout)[:3])
            if version_result.returncode or len(version) < 2 or version < (24, 10, 0):
                raise RuntimeError(f"需要 Node.js 24.10+；当前为 {version_result.stdout.strip() or '未知版本'}。")
            port = next((candidate for candidate in PORTS if port_available(candidate)), None)
            if port is None:
                raise RuntimeError("本机 4180–4190 端口均被占用，请关闭已有 AGH 服务后重试。")

            env = os.environ.copy()
            env["AGNES_PROFILE"] = PROFILE
            # Keep user/global environment untouched while giving this child a stable workspace.
            env["USERPROFILE"] = str(self.root_dir)
            args = [
                self.node,
                str(self.cli),
                "serve",
                "--port",
                str(port),
                "--profile",
                PROFILE,
                "--home",
                str(self.home),
                "--cwd",
                str(self.root_dir),
                "--data-dir",
                str(self.home / "data"),
            ]
            self.events.put(("log", f"运行依赖已就绪（Node.js {version_result.stdout.strip()}），正在启动 Web 服务…"))
            self.server = subprocess.Popen(
                args,
                cwd=str(self.root_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            self.owns_service = True
            assert self.server.stdout is not None
            for line in self.server.stdout:
                clean = line.rstrip()
                self.events.put(("log", clean))
                match = URL_PATTERN.search(clean)
                if match:
                    self.events.put(("url", match.group(0).rstrip("/")))
            code = self.server.wait()
            self.events.put(("exit", f"本地 Web 服务已退出，进程码 {code}。"))
        except Exception as error:
            self.events.put(("error", str(error)))
        finally:
            self.events.put(("idle", ""))

    @staticmethod
    def find_running_agh() -> str | None:
        for port in PORTS:
            url = f"http://127.0.0.1:{port}/"
            try:
                with urllib.request.urlopen(url, timeout=0.5) as response:
                    body = response.read(262144).decode("utf-8", errors="replace")
                    if response.status == 200 and "Agnes Harness" in body:
                        return url.rstrip("/")
            except Exception:
                continue
        return None

    def read_events(self) -> None:
        while not self.events.empty():
            kind, text = self.events.get()
            if kind == "log":
                self.log(text)
            elif kind == "url":
                self.url = text
                self.url_label.configure(text="网址：" + text)
                self.open_button.configure(state="normal")
                self.stop_button.configure(state="normal" if self.owns_service else "disabled")
                webbrowser.open(text)
                self.log("MQTT 权限迁移审计器界面已就绪，已在默认浏览器打开。")
            elif kind == "error":
                self.log("启动失败：" + text)
                messagebox.showerror("项目界面启动失败", text, parent=self)
            elif kind == "exit":
                self.log(text)
                self.url = None
                self.url_label.configure(text="网址：服务已停止")
                self.open_button.configure(state="disabled")
                self.stop_button.configure(state="disabled")
            elif kind == "idle":
                self.busy = False
                self.start_button.configure(state="normal")
        self.after(100, self.read_events)

    def open_url(self) -> None:
        if self.url:
            webbrowser.open(self.url)

    def stop(self) -> None:
        if self.owns_service and self.server and self.server.poll() is None:
            self.server.terminate()
            self.log("正在停止本次启动的 Web 服务和隔离运行进程…")
            threading.Thread(target=self.stop_daemon, daemon=True).start()

    def stop_daemon(self) -> None:
        if not self.node or not self.cli:
            return
        subprocess.run(
            [
                self.node,
                str(self.cli),
                "daemon",
                "stop",
                "--profile",
                PROFILE,
                "--home",
                str(self.home),
                "--workspace",
                str(self.root_dir),
                "--data-dir",
                str(self.home / "data"),
            ],
            cwd=str(self.root_dir),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )

    def close_window(self) -> None:
        if self.owns_service and self.server and self.server.poll() is None:
            self.stop()
            time.sleep(0.4)
        self.destroy()


if __name__ == "__main__":
    AghLauncher().mainloop()
