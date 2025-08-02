import { Relayer } from '../core/Relayer';
export declare class RelayerAPI {
    private app;
    private wss;
    private relayer;
    private connectedClients;
    constructor(relayer: Relayer);
    private setupMiddleware;
    private setupRoutes;
    start(port?: number): Promise<void>;
    private setupWebSocket;
    private handleWebSocketMessage;
    broadcastToClients(event: string, data: any): void;
    getConnectedClientsCount(): number;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map