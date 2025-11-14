/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions_agents_actions_extractVendorUrl from "../functions/agents/actions/extractVendorUrl.js";
import type * as functions_agents_emailDraftAgent from "../functions/agents/emailDraftAgent.js";
import type * as functions_agents_ticketAnalysisAgent from "../functions/agents/ticketAnalysisAgent.js";
import type * as functions_agents_tools_analyzeImage from "../functions/agents/tools/analyzeImage.js";
import type * as functions_agents_tools_classifyIssue from "../functions/agents/tools/classifyIssue.js";
import type * as functions_agents_tools_draftEmail from "../functions/agents/tools/draftEmail.js";
import type * as functions_agents_tools_draftResponse from "../functions/agents/tools/draftResponse.js";
import type * as functions_agents_tools_getAnalytics from "../functions/agents/tools/getAnalytics.js";
import type * as functions_agents_tools_queryQuotes from "../functions/agents/tools/queryQuotes.js";
import type * as functions_agents_tools_queryTickets from "../functions/agents/tools/queryTickets.js";
import type * as functions_agents_tools_queryVendors from "../functions/agents/tools/queryVendors.js";
import type * as functions_agents_tools_searchVendors from "../functions/agents/tools/searchVendors.js";
import type * as functions_agents_tools_updateTicket from "../functions/agents/tools/updateTicket.js";
import type * as functions_agents_userChatAgent from "../functions/agents/userChatAgent.js";
import type * as functions_agents_vendorConversationAgent from "../functions/agents/vendorConversationAgent.js";
import type * as functions_agents_vendorDiscoveryAction from "../functions/agents/vendorDiscoveryAction.js";
import type * as functions_agents_vendorDiscoveryAgent from "../functions/agents/vendorDiscoveryAgent.js";
import type * as functions_agents_vendorDiscoveryAgentStream from "../functions/agents/vendorDiscoveryAgentStream.js";
import type * as functions_agents_vendorRankingAgent from "../functions/agents/vendorRankingAgent.js";
import type * as functions_agents_vendorResponseAgent from "../functions/agents/vendorResponseAgent.js";
import type * as functions_analytics_queries from "../functions/analytics/queries.js";
import type * as functions_auth_actions from "../functions/auth/actions.js";
import type * as functions_auth_authHelpers from "../functions/auth/authHelpers.js";
import type * as functions_auth_getEnv from "../functions/auth/getEnv.js";
import type * as functions_auth_mutations from "../functions/auth/mutations.js";
import type * as functions_auth_queries from "../functions/auth/queries.js";
import type * as functions_conversations_mutations from "../functions/conversations/mutations.js";
import type * as functions_conversations_queries from "../functions/conversations/queries.js";
import type * as functions_discoveryLogs_mutations from "../functions/discoveryLogs/mutations.js";
import type * as functions_discoveryLogs_queries from "../functions/discoveryLogs/queries.js";
import type * as functions_emailVerification_actions from "../functions/emailVerification/actions.js";
import type * as functions_emailVerification_mutations from "../functions/emailVerification/mutations.js";
import type * as functions_emailVerification_queries from "../functions/emailVerification/queries.js";
import type * as functions_emails_actions from "../functions/emails/actions.js";
import type * as functions_emails_documentParser from "../functions/emails/documentParser.js";
import type * as functions_emails_mutations from "../functions/emails/mutations.js";
import type * as functions_embeddings_actions from "../functions/embeddings/actions.js";
import type * as functions_embeddings_mutations from "../functions/embeddings/mutations.js";
import type * as functions_embeddings_semanticSearch from "../functions/embeddings/semanticSearch.js";
import type * as functions_escalations_mutations from "../functions/escalations/mutations.js";
import type * as functions_files_queries from "../functions/files/queries.js";
import type * as functions_firecrawlResults_mutations from "../functions/firecrawlResults/mutations.js";
import type * as functions_firecrawlResults_queries from "../functions/firecrawlResults/queries.js";
import type * as functions_passwordReset_actions from "../functions/passwordReset/actions.js";
import type * as functions_passwordReset_mutations from "../functions/passwordReset/mutations.js";
import type * as functions_passwordReset_queries from "../functions/passwordReset/queries.js";
import type * as functions_pin_actions from "../functions/pin/actions.js";
import type * as functions_pin_mutations from "../functions/pin/mutations.js";
import type * as functions_pin_queries from "../functions/pin/queries.js";
import type * as functions_pinSessions_mutations from "../functions/pinSessions/mutations.js";
import type * as functions_pinSessions_queries from "../functions/pinSessions/queries.js";
import type * as functions_sessions_mutations from "../functions/sessions/mutations.js";
import type * as functions_sessions_queries from "../functions/sessions/queries.js";
import type * as functions_tickets_actions from "../functions/tickets/actions.js";
import type * as functions_tickets_mutations from "../functions/tickets/mutations.js";
import type * as functions_tickets_queries from "../functions/tickets/queries.js";
import type * as functions_vendorCallLogs_mutations from "../functions/vendorCallLogs/mutations.js";
import type * as functions_vendorOutreach_actions from "../functions/vendorOutreach/actions.js";
import type * as functions_vendorOutreach_callVendor from "../functions/vendorOutreach/callVendor.js";
import type * as functions_vendorOutreach_mutations from "../functions/vendorOutreach/mutations.js";
import type * as functions_vendorOutreach_queries from "../functions/vendorOutreach/queries.js";
import type * as functions_vendorOutreach_utils_extractEmailFromTranscript from "../functions/vendorOutreach/utils/extractEmailFromTranscript.js";
import type * as functions_vendorQuotes_actions from "../functions/vendorQuotes/actions.js";
import type * as functions_vendorQuotes_mutations from "../functions/vendorQuotes/mutations.js";
import type * as functions_vendorQuotes_queries from "../functions/vendorQuotes/queries.js";
import type * as functions_vendors_actions from "../functions/vendors/actions.js";
import type * as functions_vendors_mutations from "../functions/vendors/mutations.js";
import type * as functions_vendors_queries from "../functions/vendors/queries.js";
import type * as handlers_agents_index from "../handlers/agents/index.js";
import type * as handlers_analytics_index from "../handlers/analytics/index.js";
import type * as handlers_auth_google from "../handlers/auth/google.js";
import type * as handlers_auth_login from "../handlers/auth/login.js";
import type * as handlers_auth_logout from "../handlers/auth/logout.js";
import type * as handlers_auth_me from "../handlers/auth/me.js";
import type * as handlers_auth_onboarding from "../handlers/auth/onboarding.js";
import type * as handlers_auth_register from "../handlers/auth/register.js";
import type * as handlers_auth_validatePin from "../handlers/auth/validatePin.js";
import type * as handlers_chat_index from "../handlers/chat/index.js";
import type * as handlers_conversations_index from "../handlers/conversations/index.js";
import type * as handlers_emailVerification_sendCode from "../handlers/emailVerification/sendCode.js";
import type * as handlers_emailVerification_verifyCode from "../handlers/emailVerification/verifyCode.js";
import type * as handlers_emails_inbound from "../handlers/emails/inbound.js";
import type * as handlers_emails_webhook from "../handlers/emails/webhook.js";
import type * as handlers_files_index from "../handlers/files/index.js";
import type * as handlers_passwordReset_complete from "../handlers/passwordReset/complete.js";
import type * as handlers_passwordReset_request from "../handlers/passwordReset/request.js";
import type * as handlers_passwordReset_verify from "../handlers/passwordReset/verify.js";
import type * as handlers_tickets_afterPhotos from "../handlers/tickets/afterPhotos.js";
import type * as handlers_tickets_guestImpact from "../handlers/tickets/guestImpact.js";
import type * as handlers_tickets_index from "../handlers/tickets/index.js";
import type * as handlers_tickets_submitWithPin from "../handlers/tickets/submitWithPin.js";
import type * as handlers_tickets_vendorStatus from "../handlers/tickets/vendorStatus.js";
import type * as handlers_vendorQuotes_index from "../handlers/vendorQuotes/index.js";
import type * as handlers_vendors_index from "../handlers/vendors/index.js";
import type * as http from "../http.js";
import type * as prompts_classifyIssue from "../prompts/classifyIssue.js";
import type * as prompts_documentParser from "../prompts/documentParser.js";
import type * as prompts_draftEmail from "../prompts/draftEmail.js";
import type * as prompts_emailDraft from "../prompts/emailDraft.js";
import type * as prompts_ticketAnalysis from "../prompts/ticketAnalysis.js";
import type * as prompts_userChat from "../prompts/userChat.js";
import type * as prompts_vendorCall from "../prompts/vendorCall.js";
import type * as prompts_vendorConversation from "../prompts/vendorConversation.js";
import type * as prompts_vendorDiscovery from "../prompts/vendorDiscovery.js";
import type * as prompts_vendorExtraction from "../prompts/vendorExtraction.js";
import type * as prompts_vendorResponse from "../prompts/vendorResponse.js";
import type * as utils_attachmentUtils from "../utils/attachmentUtils.js";
import type * as utils_authHelpers from "../utils/authHelpers.js";
import type * as utils_authNode from "../utils/authNode.js";
import type * as utils_codeGeneration from "../utils/codeGeneration.js";
import type * as utils_constants from "../utils/constants.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_httpAuth from "../utils/httpAuth.js";
import type * as utils_nameUtils from "../utils/nameUtils.js";
import type * as utils_queryAuth from "../utils/queryAuth.js";
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
  "functions/agents/actions/extractVendorUrl": typeof functions_agents_actions_extractVendorUrl;
  "functions/agents/emailDraftAgent": typeof functions_agents_emailDraftAgent;
  "functions/agents/ticketAnalysisAgent": typeof functions_agents_ticketAnalysisAgent;
  "functions/agents/tools/analyzeImage": typeof functions_agents_tools_analyzeImage;
  "functions/agents/tools/classifyIssue": typeof functions_agents_tools_classifyIssue;
  "functions/agents/tools/draftEmail": typeof functions_agents_tools_draftEmail;
  "functions/agents/tools/draftResponse": typeof functions_agents_tools_draftResponse;
  "functions/agents/tools/getAnalytics": typeof functions_agents_tools_getAnalytics;
  "functions/agents/tools/queryQuotes": typeof functions_agents_tools_queryQuotes;
  "functions/agents/tools/queryTickets": typeof functions_agents_tools_queryTickets;
  "functions/agents/tools/queryVendors": typeof functions_agents_tools_queryVendors;
  "functions/agents/tools/searchVendors": typeof functions_agents_tools_searchVendors;
  "functions/agents/tools/updateTicket": typeof functions_agents_tools_updateTicket;
  "functions/agents/userChatAgent": typeof functions_agents_userChatAgent;
  "functions/agents/vendorConversationAgent": typeof functions_agents_vendorConversationAgent;
  "functions/agents/vendorDiscoveryAction": typeof functions_agents_vendorDiscoveryAction;
  "functions/agents/vendorDiscoveryAgent": typeof functions_agents_vendorDiscoveryAgent;
  "functions/agents/vendorDiscoveryAgentStream": typeof functions_agents_vendorDiscoveryAgentStream;
  "functions/agents/vendorRankingAgent": typeof functions_agents_vendorRankingAgent;
  "functions/agents/vendorResponseAgent": typeof functions_agents_vendorResponseAgent;
  "functions/analytics/queries": typeof functions_analytics_queries;
  "functions/auth/actions": typeof functions_auth_actions;
  "functions/auth/authHelpers": typeof functions_auth_authHelpers;
  "functions/auth/getEnv": typeof functions_auth_getEnv;
  "functions/auth/mutations": typeof functions_auth_mutations;
  "functions/auth/queries": typeof functions_auth_queries;
  "functions/conversations/mutations": typeof functions_conversations_mutations;
  "functions/conversations/queries": typeof functions_conversations_queries;
  "functions/discoveryLogs/mutations": typeof functions_discoveryLogs_mutations;
  "functions/discoveryLogs/queries": typeof functions_discoveryLogs_queries;
  "functions/emailVerification/actions": typeof functions_emailVerification_actions;
  "functions/emailVerification/mutations": typeof functions_emailVerification_mutations;
  "functions/emailVerification/queries": typeof functions_emailVerification_queries;
  "functions/emails/actions": typeof functions_emails_actions;
  "functions/emails/documentParser": typeof functions_emails_documentParser;
  "functions/emails/mutations": typeof functions_emails_mutations;
  "functions/embeddings/actions": typeof functions_embeddings_actions;
  "functions/embeddings/mutations": typeof functions_embeddings_mutations;
  "functions/embeddings/semanticSearch": typeof functions_embeddings_semanticSearch;
  "functions/escalations/mutations": typeof functions_escalations_mutations;
  "functions/files/queries": typeof functions_files_queries;
  "functions/firecrawlResults/mutations": typeof functions_firecrawlResults_mutations;
  "functions/firecrawlResults/queries": typeof functions_firecrawlResults_queries;
  "functions/passwordReset/actions": typeof functions_passwordReset_actions;
  "functions/passwordReset/mutations": typeof functions_passwordReset_mutations;
  "functions/passwordReset/queries": typeof functions_passwordReset_queries;
  "functions/pin/actions": typeof functions_pin_actions;
  "functions/pin/mutations": typeof functions_pin_mutations;
  "functions/pin/queries": typeof functions_pin_queries;
  "functions/pinSessions/mutations": typeof functions_pinSessions_mutations;
  "functions/pinSessions/queries": typeof functions_pinSessions_queries;
  "functions/sessions/mutations": typeof functions_sessions_mutations;
  "functions/sessions/queries": typeof functions_sessions_queries;
  "functions/tickets/actions": typeof functions_tickets_actions;
  "functions/tickets/mutations": typeof functions_tickets_mutations;
  "functions/tickets/queries": typeof functions_tickets_queries;
  "functions/vendorCallLogs/mutations": typeof functions_vendorCallLogs_mutations;
  "functions/vendorOutreach/actions": typeof functions_vendorOutreach_actions;
  "functions/vendorOutreach/callVendor": typeof functions_vendorOutreach_callVendor;
  "functions/vendorOutreach/mutations": typeof functions_vendorOutreach_mutations;
  "functions/vendorOutreach/queries": typeof functions_vendorOutreach_queries;
  "functions/vendorOutreach/utils/extractEmailFromTranscript": typeof functions_vendorOutreach_utils_extractEmailFromTranscript;
  "functions/vendorQuotes/actions": typeof functions_vendorQuotes_actions;
  "functions/vendorQuotes/mutations": typeof functions_vendorQuotes_mutations;
  "functions/vendorQuotes/queries": typeof functions_vendorQuotes_queries;
  "functions/vendors/actions": typeof functions_vendors_actions;
  "functions/vendors/mutations": typeof functions_vendors_mutations;
  "functions/vendors/queries": typeof functions_vendors_queries;
  "handlers/agents/index": typeof handlers_agents_index;
  "handlers/analytics/index": typeof handlers_analytics_index;
  "handlers/auth/google": typeof handlers_auth_google;
  "handlers/auth/login": typeof handlers_auth_login;
  "handlers/auth/logout": typeof handlers_auth_logout;
  "handlers/auth/me": typeof handlers_auth_me;
  "handlers/auth/onboarding": typeof handlers_auth_onboarding;
  "handlers/auth/register": typeof handlers_auth_register;
  "handlers/auth/validatePin": typeof handlers_auth_validatePin;
  "handlers/chat/index": typeof handlers_chat_index;
  "handlers/conversations/index": typeof handlers_conversations_index;
  "handlers/emailVerification/sendCode": typeof handlers_emailVerification_sendCode;
  "handlers/emailVerification/verifyCode": typeof handlers_emailVerification_verifyCode;
  "handlers/emails/inbound": typeof handlers_emails_inbound;
  "handlers/emails/webhook": typeof handlers_emails_webhook;
  "handlers/files/index": typeof handlers_files_index;
  "handlers/passwordReset/complete": typeof handlers_passwordReset_complete;
  "handlers/passwordReset/request": typeof handlers_passwordReset_request;
  "handlers/passwordReset/verify": typeof handlers_passwordReset_verify;
  "handlers/tickets/afterPhotos": typeof handlers_tickets_afterPhotos;
  "handlers/tickets/guestImpact": typeof handlers_tickets_guestImpact;
  "handlers/tickets/index": typeof handlers_tickets_index;
  "handlers/tickets/submitWithPin": typeof handlers_tickets_submitWithPin;
  "handlers/tickets/vendorStatus": typeof handlers_tickets_vendorStatus;
  "handlers/vendorQuotes/index": typeof handlers_vendorQuotes_index;
  "handlers/vendors/index": typeof handlers_vendors_index;
  http: typeof http;
  "prompts/classifyIssue": typeof prompts_classifyIssue;
  "prompts/documentParser": typeof prompts_documentParser;
  "prompts/draftEmail": typeof prompts_draftEmail;
  "prompts/emailDraft": typeof prompts_emailDraft;
  "prompts/ticketAnalysis": typeof prompts_ticketAnalysis;
  "prompts/userChat": typeof prompts_userChat;
  "prompts/vendorCall": typeof prompts_vendorCall;
  "prompts/vendorConversation": typeof prompts_vendorConversation;
  "prompts/vendorDiscovery": typeof prompts_vendorDiscovery;
  "prompts/vendorExtraction": typeof prompts_vendorExtraction;
  "prompts/vendorResponse": typeof prompts_vendorResponse;
  "utils/attachmentUtils": typeof utils_attachmentUtils;
  "utils/authHelpers": typeof utils_authHelpers;
  "utils/authNode": typeof utils_authNode;
  "utils/codeGeneration": typeof utils_codeGeneration;
  "utils/constants": typeof utils_constants;
  "utils/errors": typeof utils_errors;
  "utils/httpAuth": typeof utils_httpAuth;
  "utils/nameUtils": typeof utils_nameUtils;
  "utils/queryAuth": typeof utils_queryAuth;
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

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          createdAt: number;
          errorMessage?: string;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject: string;
          text?: string;
          to: string;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          errorMessage: string | null;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject: string;
          text?: string;
          to: string;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
};
