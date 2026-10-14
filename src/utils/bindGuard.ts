/**
 * W3-warn: publiczny bind w produkcji bez reverse proxy wystawia surowy
 * HTTP w sieci. Czysty predykat (testowalny) — woła go server.ts przy starcie.
 * Docker celowo słucha na 0.0.0.0 (osobny kontener proxy), więc to tylko
 * ostrzeżenie, nigdy blokada. Enforce (odmowa startu) wymaga osobnej decyzji.
 */
export function shouldWarnPublicBind(nodeEnv: string, host: string): boolean {
    return nodeEnv === 'production' && host === '0.0.0.0';
}
