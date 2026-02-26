"""Capture a gameplay screenshot with Playwright.

This script intentionally prefers Firefox first as a workaround for
Chromium SIGSEGV crashes observed in some containerized environments.
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:4173"
OUT = Path("artifacts/factory-screenshot.png")


def capture_with_fallback() -> tuple[str, str]:
    OUT.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        attempts = [
            ("firefox", p.firefox),
            ("webkit", p.webkit),
            ("chromium", p.chromium),
        ]

        last_error = None
        for name, browser_type in attempts:
            try:
                browser = browser_type.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 960})
                page.goto(URL, wait_until="load")
                page.click("#manualBtn")
                page.screenshot(path=str(OUT), full_page=True)
                browser.close()
                return name, str(OUT)
            except Exception as exc:  # fallback between browser engines
                last_error = exc

        raise RuntimeError(f"All browser engines failed: {last_error}")


if __name__ == "__main__":
    engine, output = capture_with_fallback()
    print(f"Screenshot captured with {engine}: {output}")
