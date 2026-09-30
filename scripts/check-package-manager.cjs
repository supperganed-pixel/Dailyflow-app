if (!process.env.npm_config_user_agent?.startsWith("pnpm/")) {
  console.error("Please install this workspace with pnpm.");
  process.exit(1);
}
