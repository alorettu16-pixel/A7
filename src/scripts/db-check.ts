import db from "../db";
import { strategies } from "../db/schema";

const all = db.select().from(strategies).all();
console.log("Strategie trovate:", all.length);
all.forEach((s: any) => console.log("  -", s.name, s.status));