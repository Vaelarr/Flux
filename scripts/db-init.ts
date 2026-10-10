import { getDatabase } from "../server/db.js";
const db = await getDatabase();
console.log("Flux account tables are ready.");
db.close();
