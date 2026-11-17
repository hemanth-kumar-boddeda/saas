// Writes reel/skills/<name>/SKILL.md from the definitions. Run: ts-node --transpile-only -P tsconfig.json reel/skills/generate.ts
import fs from "fs";
import path from "path";
import { SKILLS, renderSkillMd } from "./index";
for (const s of SKILLS) {
  const d = path.join(__dirname, s.name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "SKILL.md"), renderSkillMd(s));
}
