import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

// Empêche Winston/Morgan d'écrire sur disque pendant les tests
process.env.LOG_LEVEL = "silent";

jest.setTimeout(30000);
