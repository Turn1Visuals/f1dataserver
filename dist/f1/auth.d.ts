export declare function saveToken(token: string): void;
export declare function loadToken(): string | null;
export declare function clearToken(): void;
export declare function getTokenStatus(): {
    loggedIn: boolean;
    expiresAt: string | null;
    pending: boolean;
};
export declare function startLogin(): Promise<void>;
//# sourceMappingURL=auth.d.ts.map