// Extension entry — chạy trong isolated world (MV3). snapdom BUNDLE THẲNG vì CSP
// của extension cấm dynamic import URL ngoài. Config do popup set vào __km_cfg trước khi inject.
import { snapdom } from "@zumer/snapdom";
import { bootKrymark, provideSnapdom } from "./core";

provideSnapdom(snapdom);
const cfg = (window as unknown as { __km_cfg?: { key: string; origin: string } }).__km_cfg;
if (cfg?.key && cfg?.origin) {
  bootKrymark(cfg.key, cfg.origin);
}
