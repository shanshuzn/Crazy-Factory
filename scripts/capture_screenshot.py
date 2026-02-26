"""Capture a gameplay screenshot with Playwright.

Fallback strategy is designed for container/CI environments where Chromium can
crash with SIGSEGV. Firefox is attempted first by default.
"""

from __future__ import annotations

import os
from pathlib import Path
from playwright.sync_api import Error, TimeoutError, sync_playwright

URL = os.getenv("SCREENSHOT_URL", "http://127.0.0.1:4173")
OUT = Path(os.getenv("SCREENSHOT_OUT", "artifacts/factory-screenshot.png"))
VIEWPORT = {"width": 1280, "height": 960}


def _engine_order() -> list[str]:
    raw = os.getenv("SCREENSHOT_ENGINES", "firefox,webkit,chromium")
    order = [x.strip().lower() for x in raw.split(",") if x.strip()]
    valid = [x for x in order if x in {"firefox", "webkit", "chromium"}]
    return valid or ["firefox", "webkit", "chromium"]


def _launch_kwargs(engine: str) -> dict:
    # Chromium in constrained containers can be crash-prone; keep it minimal.
    if engine == "chromium":
        return {"args": ["--disable-dev-shm-usage", "--no-sandbox"]}
    return {}


def capture_with_fallback() -> tuple[str, str, list[str]]:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []

    with sync_playwright() as p:
        engine_map = {
            "firefox": p.firefox,
            "webkit": p.webkit,
            "chromium": p.chromium,
        }

        for name in _engine_order():
            browser_type = engine_map[name]
            browser = None
            try:
                browser = browser_type.launch(**_launch_kwargs(name))
                page = browser.new_page(viewport=VIEWPORT)
                page.goto(URL, wait_until="load", timeout=15_000)
                page.click("#manualBtn", timeout=5_000)
                page.screenshot(path=str(OUT), full_page=True)
                return name, str(OUT), errors
            except (TimeoutError, Error, Exception) as exc:  # engine fallback
                errors.append(f"{name}: {exc}")
            finally:
                if browser:
                    browser.close()

    raise RuntimeError("All browser engines failed: " + " | ".join(errors))


if __name__ == "__main__":
    engine, output, failures = capture_with_fallback()
    if failures:
        print("Fallback notes:")
        for item in failures:
            print(f"- {item}")
    print(f"Screenshot captured with {engine}: {output}")
