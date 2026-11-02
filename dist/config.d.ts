import type { ServerConfig } from './types.js';
export declare const ENV_KEYS: {
    readonly SOCIALMEDIA_API_BASE_URL: "SOCIALMEDIA_API_BASE_URL";
    readonly SOCIALMEDIA_API_KEY: "SOCIALMEDIA_API_KEY";
    readonly SOCIALMEDIA_TEAM_ID: "SOCIALMEDIA_TEAM_ID";
    readonly PORT: "PORT";
    readonly LOG_LEVEL: "LOG_LEVEL";
    readonly API_TIMEOUT: "API_TIMEOUT";
    readonly MCP_TRANSPORT: "MCP_TRANSPORT";
    readonly MCP_HTTP_PORT: "MCP_HTTP_PORT";
    readonly MCP_HTTP_HOST: "MCP_HTTP_HOST";
    readonly MCP_ENABLE_JSON: "MCP_ENABLE_JSON";
    readonly MCP_CORS_ORIGIN: "MCP_CORS_ORIGIN";
};
export declare const version: string;
export declare function getConfig(): ServerConfig;
export declare const config: ServerConfig;
export declare function validateConfig(): void;
//# sourceMappingURL=config.d.ts.map