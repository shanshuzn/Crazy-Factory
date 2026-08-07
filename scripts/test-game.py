"""Test game page WebSocket connection and console logs."""
import sys
from playwright.sync_api import sync_playwright

console_logs = []
page_errors = []


def on_console(msg):
    console_logs.append(f"[{msg.type}] {msg.text}")


def on_pageerror(err):
    page_errors.append(str(err))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    print("Navigating to http://127.0.0.1:4173...")
    page.goto("http://127.0.0.1:4173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    print("\n=== Console Logs ===")
    for log in console_logs:
        print(log)
    if not console_logs:
        print("(no console logs)")

    print("\n=== Page Errors ===")
    for err in page_errors:
        print(err)
    if not page_errors:
        print("(no errors)")

    print("\n=== Bridge Status ===")
    bridge_status = page.evaluate("""
        () => {
            const el = document.getElementById('mcpBridgeStatus');
            return el ? el.textContent : 'NOT FOUND';
        }
    """)
    print(f"Bridge status: {bridge_status}")

    print("\n=== Game State Test ===")
    try:
        state = page.evaluate("""
            () => {
                if (typeof window.gameBridge === 'undefined') return { error: 'gameBridge not defined' };
                if (!window.gameBridge.isConnected()) return { error: 'not connected' };
                return window.gameBridge.getState();
            }
        """)
        print(f"Game state: {state}")
    except Exception as e:
        print(f"Error: {e}")

    page.screenshot(path="D:/OpenClaw/Crazy-Factory/artifacts/game-test.png")
    print("\nScreenshot saved to artifacts/game-test.png")

    browser.close()
