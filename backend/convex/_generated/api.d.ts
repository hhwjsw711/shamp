/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions_auth_actions from "../functions/auth/actions.js";
import type * as functions_auth_authHelpers from "../functions/auth/authHelpers.js";
import type * as functions_auth_getEnv from "../functions/auth/getEnv.js";
import type * as functions_auth_mutations from "../functions/auth/mutations.js";
import type * as functions_auth_queries from "../functions/auth/queries.js";
import type * as functions_emailVerification_actions from "../functions/emailVerification/actions.js";
import type * as functions_emailVerification_mutations from "../functions/emailVerification/mutations.js";
import type * as functions_emailVerification_queries from "../functions/emailVerification/queries.js";
import type * as functions_passwordReset_actions from "../functions/passwordReset/actions.js";
import type * as functions_passwordReset_mutations from "../functions/passwordReset/mutations.js";
import type * as functions_passwordReset_queries from "../functions/passwordReset/queries.js";
import type * as functions_sessions_mutations from "../functions/sessions/mutations.js";
import type * as functions_sessions_queries from "../functions/sessions/queries.js";
import type * as handlers_auth_google from "../handlers/auth/google.js";
import type * as handlers_auth_login from "../handlers/auth/login.js";
import type * as handlers_auth_logout from "../handlers/auth/logout.js";
import type * as handlers_auth_me from "../handlers/auth/me.js";
import type * as handlers_auth_register from "../handlers/auth/register.js";
import type * as handlers_emailVerification_sendCode from "../handlers/emailVerification/sendCode.js";
import type * as handlers_emailVerification_verifyCode from "../handlers/emailVerification/verifyCode.js";
import type * as http from "../http.js";
import type * as utils_authHelpers from "../utils/authHelpers.js";
import type * as utils_authNode from "../utils/authNode.js";
import type * as utils_codeGeneration from "../utils/codeGeneration.js";
import type * as utils_constants from "../utils/constants.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_security from "../utils/security.js";
import type * as utils_validation from "../utils/validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "functions/auth/actions": typeof functions_auth_actions;
  "functions/auth/authHelpers": typeof functions_auth_authHelpers;
  "functions/auth/getEnv": typeof functions_auth_getEnv;
  "functions/auth/mutations": typeof functions_auth_mutations;
  "functions/auth/queries": typeof functions_auth_queries;
  "functions/emailVerification/actions": typeof functions_emailVerification_actions;
  "functions/emailVerification/mutations": typeof functions_emailVerification_mutations;
  "functions/emailVerification/queries": typeof functions_emailVerification_queries;
  "functions/passwordReset/actions": typeof functions_passwordReset_actions;
  "functions/passwordReset/mutations": typeof functions_passwordReset_mutations;
  "functions/passwordReset/queries": typeof functions_passwordReset_queries;
  "functions/sessions/mutations": typeof functions_sessions_mutations;
  "functions/sessions/queries": typeof functions_sessions_queries;
  "handlers/auth/google": typeof handlers_auth_google;
  "handlers/auth/login": typeof handlers_auth_login;
  "handlers/auth/logout": typeof handlers_auth_logout;
  "handlers/auth/me": typeof handlers_auth_me;
  "handlers/auth/register": typeof handlers_auth_register;
  "handlers/emailVerification/sendCode": typeof handlers_emailVerification_sendCode;
  "handlers/emailVerification/verifyCode": typeof handlers_emailVerification_verifyCode;
  http: typeof http;
  "utils/authHelpers": typeof utils_authHelpers;
  "utils/authNode": typeof utils_authNode;
  "utils/codeGeneration": typeof utils_codeGeneration;
  "utils/constants": typeof utils_constants;
  "utils/errors": typeof utils_errors;
  "utils/security": typeof utils_security;
  "utils/validation": typeof utils_validation;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
