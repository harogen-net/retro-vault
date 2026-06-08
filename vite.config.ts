import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "retro-vault";
	const base = mode === "production" ? `/${repoName}/` : "/";
	const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
		version?: string;
	};
	const packageVersion = pkg.version ?? "0.0.0";

	let gitRevision = "nogit";
	try {
		gitRevision = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
			.toString()
			.trim();
	} catch {
		// Keep fallback when git metadata is unavailable.
	}

	const builtAt = new Date().toISOString();
	const compactBuiltAt = builtAt.replace(/[-:TZ.]/g, "").slice(0, 14);
	const deployId = process.env.GITHUB_RUN_ID
		? `ghp-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
		: `local-${compactBuiltAt}`;
	const appDisplayVersion = `v${packageVersion}+${gitRevision}`;
	const buildInfo = {
		version: packageVersion,
		revision: gitRevision,
		deployId,
		displayVersion: appDisplayVersion,
		builtAt,
	};

	return {
		base,
		define: {
			__APP_VERSION__: JSON.stringify(packageVersion),
			__APP_REVISION__: JSON.stringify(gitRevision),
			__APP_DEPLOY_ID__: JSON.stringify(deployId),
			__APP_DISPLAY_VERSION__: JSON.stringify(appDisplayVersion),
			__APP_BUILT_AT__: JSON.stringify(builtAt),
		},
		plugins: [
			react(),
			VitePWA({
				registerType: "autoUpdate",
				includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
				manifest: {
					name: "Retro Vault",
					short_name: "RetroVault",
					description: "Retro-styled offline photo vault application",
					lang: "ja",
					theme_color: "#0e1422",
					background_color: "#0e1422",
					display: "standalone",
					display_override: ["standalone", "minimal-ui"],
					start_url: base,
					scope: base,
					icons: [
						{
							src: "icon-192.png",
							sizes: "192x192",
							type: "image/png",
							purpose: "any",
						},
						{
							src: "icon-512.png",
							sizes: "512x512",
							type: "image/png",
							purpose: "any maskable",
						},
						{
							src: "favicon.svg",
							sizes: "any",
							type: "image/svg+xml",
							purpose: "any",
						},
					],
				},
				workbox: {
					globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
				},
			}),
			{
				name: "emit-build-version",
				generateBundle() {
					this.emitFile({
						type: "asset",
						fileName: "version.json",
						source: JSON.stringify(buildInfo, null, 2),
					});
				},
			},
			{
				name: "print-deploy-id",
				closeBundle() {
					console.log(`[build] deploy id: ${deployId}`);
				},
			},
		],
	};
});
