import * as esbuild from "esbuild"

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

async function main() {
    const extensionCtx = await esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        outfile: "dist/extension.cjs",
        external: ["vscode"],
        logLevel: "info",
    })

    const webviewCtx = await esbuild.context({
        entryPoints: ["src/webview-ui/main.ts"],
        bundle: true,
        format: "iife",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "browser",
        outfile: "dist/webview-ui/main.js",
        logLevel: "info",
    })

    if (watch) {
        await extensionCtx.watch()
        await webviewCtx.watch()
    } else {
        await extensionCtx.rebuild()
        await webviewCtx.rebuild()
        await extensionCtx.dispose()
        await webviewCtx.dispose()
    }
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
