import { AwilixContainer, FunctionReturning } from './container';
import { InjectionModeType } from './injection-mode';
import { LifetimeType } from './lifetime';
/**
 * RESOLVER symbol can be used by modules loaded by
 * `loadModules` to configure their lifetime, injection mode, etc.
 */
export declare const RESOLVER: unique symbol;
/**
 * Gets passed the container and is expected to return an object
 * whose properties are accessible at construction time for the
 * configured resolver.
 *
 * @type {Function}
 */
export type InjectorFunction = <T extends object>(container: AwilixContainer<T>) => object;
/**
 * A resolver object returned by asClass(), asFunction() or asValue().
 */
export interface Resolver<T> extends ResolverOptions<T> {
    resolve<U extends object>(container: AwilixContainer<U>): T;
}
/**
 * A resolver object created by asClass() or asFunction().
 */
export interface BuildResolver<T> extends Resolver<T>, BuildResolverOptions<T> {
    injectionMode?: InjectionModeType;
    injector?: InjectorFunction;
    setLifetime(lifetime: LifetimeType): this;
    setInjectionMode(mode: InjectionModeType): this;
    singleton(): this;
    scoped(): this;
    transient(): this;
    proxy(): this;
    classic(): this;
    inject(injector: InjectorFunction): this;
}
/**
 * Options for disposable resolvers.
 */
export interface DisposableResolverOptions<T> extends ResolverOptions<T> {
    dispose?: Disposer<T>;
}
/**
 * Disposable resolver.
 */
export interface DisposableResolver<T> extends Resolver<T>, DisposableResolverOptions<T> {
    disposer(dispose: Disposer<T>): this;
}
/**
 * Disposer function type.
 */
export type Disposer<T> = (value: T) => any | Promise<any>;
/**
 * The options when registering a class, function or value.
 * @type RegistrationOptions
 */
export interface ResolverOptions<T> {
    /**
     * Only used for inline configuration with `loadModules`.
     */
    name?: string;
    /**
     * Lifetime setting.
     */
    lifetime?: LifetimeType;
    /**
     * Registration function to use. Only used for inline configuration with `loadModules`.
     */
    register?: (...args: any[]) => Resolver<T>;
    /**
     * True if this resolver should be excluded from lifetime leak checking. Used by resolvers that
     * wish to uphold the anti-leakage contract themselves. Defaults to false.
     */
    isLeakSafe?: boolean;
}
/**
 * Builder resolver options.
 */
export interface BuildResolverOptions<T> extends ResolverOptions<T>, DisposableResolverOptions<T> {
    /**
     * Resolution mode.
     */
    injectionMode?: InjectionModeType;
    /**
     * Injector function to provide additional parameters.
     */
    injector?: InjectorFunction;
}
/**
 * A class constructor. For example:
 *
 *    class MyClass {}
 *
 *    container.registerClass('myClass', MyClass)
 *                                       ^^^^^^^
 */
export type Constructor<T> = {
    new (...args: any[]): T;
};
/**
 * Creates a simple value resolver where the given value will always be resolved. The value is
 * marked as leak-safe since in strict mode, the value will only be resolved when it is not leaking
 * upwards from a child scope to a parent singleton.
 *
 * @param  {string} name The name to register the value as.
 *
 * @param  {*} value The value to resolve.
 *
 * @return {object} The resolver.
 */
export declare function asValue<T>(value: T): Resolver<T>;
/**
 * Creates a factory resolver, where the given factory function
 * will be invoked with `new` when requested.
 *
 * @param  {string} name
 * The name to register the value as.
 *
 * @param  {Function} fn
 * The function to register.
 *
 * @param {object} opts
 * Additional options for the resolver.
 *
 * @return {object}
 * The resolver.
 */
export declare function asFunction<T>(fn: FunctionReturning<T>, opts?: BuildResolverOptions<T>): BuildResolver<T> & DisposableResolver<T>;
/**
 * Like a factory resolver, but for classes that require `new`.
 *
 * @param  {string} name
 * The name to register the value as.
 *
 * @param  {Class} Type
 * The function to register.
 *
 * @param {object} opts
 * Additional options for the resolver.
 *
 * @return {object}
 * The resolver.
 */
export declare function asClass<T = object>(Type: Constructor<T>, opts?: BuildResolverOptions<T>): BuildResolver<T> & DisposableResolver<T>;
/**
 * Resolves to the specified registration. Marked as leak-safe since the alias target is what should
 * be checked for lifetime leaks.
 */
export declare function aliasTo<T>(name: Parameters<AwilixContainer['resolve']>[0]): Resolver<T>;
/**
 * Given an options object, creates a fluid interface
 * to manage it.
 *
 * @param {*} obj
 * The object to return.
 *
 * @return {object}
 * The interface.
 */
export declare function createBuildResolver<T, B extends Resolver<T>>(obj: B): BuildResolver<T> & B;
/**
 * Given a resolver, returns an object with methods to manage the disposer
 * function.
 * @param obj
 */
export declare function createDisposableResolver<T, B extends Resolver<T>>(obj: B): DisposableResolver<T> & B;
