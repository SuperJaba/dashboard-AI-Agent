from playwright.sync_api import sync_playwright

# 👉 Update this to the title you expect
EXPECTED_TITLE = "Dashboard"

def main() -> None:
    with sync_playwright() as p:
        # Headless Chromium (fast, CI‑friendly)
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the running dev server
        page.goto("http://localhost:5173/")
        # Ensure all JS has executed
        page.wait_for_load_state("networkidle")

        # Grab the actual title
        actual_title = page.title()
        print(f"Page title: {actual_title!r}")

        # Assertion
        if actual_title == EXPECTED_TITLE:
            print("✅ Title matches expected value.")
        else:
            print(
                f"❌ Title mismatch! Expected {EXPECTED_TITLE!r}, got {actual_title!r}"
            )
            raise SystemExit(1)

        # Clean up
        browser.close()

if __name__ == "__main__":
    main()
