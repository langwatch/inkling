import { withScenario } from "@langwatch/scenario/integrations/vitest/config";
import { defineConfig } from "vitest/config";

export default withScenario(
  defineConfig({
    test: {
      include: ["flow.test.mjs"],
      globalSetup: ["./global-setup.mjs"],
      // Each case runs a full agent session with its own reader panels; keep the machine responsive.
      maxConcurrency: Number(process.env.INKLING_FLOW_CONCURRENCY || 2),
      testTimeout: 0,
      hookTimeout: 600_000,
      watch: false,
    },
  }),
);
