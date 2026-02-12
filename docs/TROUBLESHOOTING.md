# Troubleshooting Guide 🩺

If Marie's magic feels a bit heavy, use this guide to restore harmony to your workspace.

## 🔑 API Key Issues

### "Please set your API Key..."
- **Cause**: The API key is missing or not recognized.
- **Fix**: Go to VS Code Settings -> `Marie` -> `Api Key` (or `OpenRouter Api Key`) and ensure it's saved.

### Authentication Errors (401/403)
- **Cause**: Incorrect API key.
- **Fix**: Double-check for trailing spaces or expired keys in the provider's dashboard.

## 🌀 Configuration & State

### Resetting Chat History
If the chat feels cluttered or Marie is confused, use the **Marie: Clear Chat** command (`Cmd+Shift+P` -> `Clear Chat`).

### Workspace State
Marie stores history in `workspaceState`. If you're seeing incorrect history, try reloading the VS Code window.

## 📐 Zoning Violations

### "Conceptual Backflow Detected"
- **Cause**: A file in a lower zone (Plumbing) is trying to import from a higher zone (Joyful).
- **Fix**: Refactor the logic to move the dependency downward or extract the shared logic into a Plumbing utility.

## 🛠️ Build Issues

### "Webview not found"
- **Cause**: The webview code hasn't been built.
- **Fix**: Run `npm run build-webview` in the project root.

---
*Verified and Documented with Love. ✨*
