// Next 16 removed `next lint`; eslint-config-next v16 ships native flat
// configs, so plain `eslint .` works with the same Next.js rule sets.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/sw.js", // plain service-worker script, not part of the app graph
      "scripts/**",   // dev/test harnesses, run via tsx — not shipped app code
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
