"""Test WebSocket connection from browser to MCP Bridge."""
import sys
from playwright.sync_api import sync_playwright

console_logs = []
page_errors = []
ws_events = []


def on_console(msg):
    console_logs.append(f"[{msg.type}] {msg.text}")


def on_pageerror(err):
    page_errors.append(str(err))


def on_websocket(ws):
    print(f"WebSocket opened: {ws.url}")
    ws_events.append(f"OPEN: {ws.url}")
    ws.on("close", lambda: ws_events.append(f"CLOSE: {ws.url}"))
    ws.on("framesent", lambda payload: ws_events.append(f"SENT: {payload.payload[:100]}"))
    ws.on("framereceived", lambda payload: ws_events.append(f"RECV: {payload.payload[:100]}"))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    context.on("websocket", on_websocket)

    page = context.new_page()
    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    print("Navigating to http://127.0.0.1:4173...")
    page.goto("http://127.0.0.1:4173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(5000)

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

    print("\n=== WebSocket Events ===")
    for ev in ws_events:
        print(ev)
    if not ws_events:
        print("(no WebSocket events)")

    print("\n=== Bridge Status ===")
    bridge_status = page.evaluate("""
        () => {
            const el = document.getElementById('mcpBridgeStatus');
            return el ? el.textContent : 'NOT FOUND';
        }
    """)
    print(f"Bridge status: {bridge_status}")

    print("\n=== Game Bridge Test ===")
    state = page.evaluate("""
        () => {
            if (typeof window.gameBridge === 'undefined') return { error: 'gameBridge not defined' };
            return {
                isConnected: window.gameBridge.isConnected(),
                state: typeof window.gameBridge.getState === 'function' ? 'has getState' : 'no getState'
            };
        }
    """)
    print(f"GameBridge: {state}")

    browser.close()
