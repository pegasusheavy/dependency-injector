/**
 * Lifetime type.
 */
export type LifetimeType = 'SINGLETON' | 'TRANSIENT' | 'SCOPED';
/**
 * Lifetime types.
 */
export declare const Lifetime: Record<LifetimeType, LifetimeType>;
/**
 * Returns true if and only if the first lifetime is strictly longer than the second.
 */
export declare function isLifetimeLonger(a: LifetimeType, b: LifetimeType): boolean;
