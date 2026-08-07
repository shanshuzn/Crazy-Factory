import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    
    page.goto("http://127.0.0.1:4173", timeout=15000)
    page.wait_for_timeout(4000)
    
    page.screenshot(path="D:/OpenClaw/Crazy-Factory/game-view.png", full_page=False)
    
    title = page.title()
    print(f"Title: {title}")
    
    gears_el = page.query_selector("#gears")
    if gears_el:
        print(f"Gears: {gears_el.text_content()}")
    
    money_el = page.query_selector("#money")
    if money_el:
        print(f"Money: {money_el.text_content()}")
    
    btns = page.query_selector_all(".build-btn")
    print(f"Build buttons: {len(btns)}")
    for b in btns[:8]:
        print(f"  - {b.text_content().strip()[:60]}")
    
    if errors:
        print(f"Console errors ({len(errors)}):")
        for e in errors[:10]:
            print(f"  - {e[:120]}")
    else:
        print("No console errors.")
    
    browser.close()
