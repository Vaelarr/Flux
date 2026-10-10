import { createAuthHandler } from "../../server/http.js";
import { getAuthRuntime } from "../../server/runtime.js";

export default createAuthHandler(getAuthRuntime);
