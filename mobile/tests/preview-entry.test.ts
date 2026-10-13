/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

test.each([
  { dev: false, flag: "1", entry: "expo-router/entry" },
  { dev: true, flag: undefined, entry: "expo-router/entry" },
  { dev: true, flag: "1", entry: "./src/preview/entry" },
])("the entry point isolates demo mode: %j", ({ dev, flag, entry }) => {
  const load = jest.fn();
  runInNewContext(readFileSync(join(__dirname, "../index.js"), "utf8"), {
    __DEV__: dev,
    process: { env: { EXPO_PUBLIC_DESIGN_PREVIEW: flag } },
    require: load,
  });
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith(entry);
});
